import Link from 'next/link';
import { Layers3, BookOpenText, CheckCircle2 } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { courseCatalog } from '@/lib/course-catalog';
import { getAdminCourseCatalog } from '@/lib/admin-course-catalog';
import prisma from '@/lib/prisma';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'formation';
}

export default async function CoursesPage() {
  const adminCourses = await getAdminCourseCatalog();
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId: string | null = null;
  if (isAuthDisabled) {
    clerkId = 'local';
  } else {
    const authData = await auth();
    clerkId = authData.userId ?? null;
  }

  const courseStatusMap = new Map<string, { quizDone: boolean; challengeDone: boolean; validated: boolean }>();

  if (clerkId) {
    try {
      const [quizSlugs, challengeSlugs] = await Promise.all([
        prisma.courseQuizAttempt.findMany({
          where: { clerkId },
          select: { courseSlug: true },
          distinct: ['courseSlug'],
        }),
        prisma.courseChallengeAttempt.findMany({
          where: { clerkId, status: 'success' },
          select: { courseSlug: true },
          distinct: ['courseSlug'],
        }),
      ]);

      const quizDone = new Set(quizSlugs.map((r) => r.courseSlug));
      const challengeDone = new Set(challengeSlugs.map((r) => r.courseSlug));

      for (const slug of new Set([...quizDone, ...challengeDone])) {
        const q = quizDone.has(slug);
        const c = challengeDone.has(slug);
        courseStatusMap.set(slug, { quizDone: q, challengeDone: c, validated: q && c });
      }
    } catch {
      // silent fallback
    }
  }

  const cards =
    adminCourses.length > 0
      ? adminCourses.map((course) => ({
          slug: course.slug,
          title: course.title,
          level: course.level,
          formationName: course.formationName || 'Formation générale',
        }))
      : courseCatalog.map((course) => ({
          slug: course.slug,
          title: course.title,
          level: course.level,
          formationName: 'Formation générale',
        }));

  const groupedByFormation = cards.reduce<Record<string, typeof cards>>((acc, card) => {
    const key = card.formationName || 'Formation générale';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(card);
    return acc;
  }, {});

  const formations = Object.entries(groupedByFormation)
    .map(([formationName, formationCourses]) => {
      const totalCourses = formationCourses.length;
      const validatedCourses = formationCourses.reduce((count, course) => {
        const status = courseStatusMap.get(course.slug);
        return count + (status?.validated ? 1 : 0);
      }, 0);

      const completionPercent = totalCourses > 0 ? Math.round((validatedCourses / totalCourses) * 100) : 0;
      const levels = Array.from(new Set(formationCourses.map((course) => course.level))).join(', ');

      return {
        formationName,
        formationSlug: slugify(formationName),
        totalCourses,
        validatedCourses,
        completionPercent,
        levels,
      };
    })
    .sort((a, b) => a.formationName.localeCompare(b.formationName));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 lg:p-5 space-y-2.5">
        <p className="text-[11px] text-primary font-semibold uppercase tracking-wide">Учебный путь</p>
        <h1 className="text-xl lg:text-2xl font-bold leading-tight">Доступные курсы</h1>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Выбери курс и проходи его урок за уроком с ИИ-проверкой и мини-заданием.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {formations.map((formation) => (
          <article key={formation.formationSlug} className="rounded-lg border bg-card p-3 space-y-2.5 hover:bg-accent/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Курс</p>
                <h2 className="text-sm font-semibold leading-tight mt-1 line-clamp-2">{formation.formationName}</h2>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">Уровни: {formation.levels}</p>
              </div>

              <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                <Layers3 className="h-4 w-4" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div className="rounded-md border bg-background p-2">
                <p className="text-muted-foreground">Уроки</p>
                <p className="font-semibold text-xs">{formation.totalCourses}</p>
              </div>
              <div className="rounded-md border bg-primary/10 border-primary/30 p-2">
                <p className="text-muted-foreground">Пройдено</p>
                <p className="font-semibold text-xs text-primary inline-flex items-center gap-1">
                  {formation.validatedCourses > 0 && <CheckCircle2 className="h-3 w-3" />}
                  {formation.validatedCourses}
                </p>
              </div>
              <div className="rounded-md border bg-background p-2">
                <p className="text-muted-foreground">Прогресс</p>
                <p className="font-semibold text-xs">{formation.completionPercent}%</p>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${formation.completionPercent}%` }} />
            </div>

            <Link
              href={`/courses/formations/${formation.formationSlug}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <BookOpenText className="h-3.5 w-3.5" /> Открыть курс
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
