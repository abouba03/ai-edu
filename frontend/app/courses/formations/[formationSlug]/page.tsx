import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, CircleAlert, Clock3, GraduationCap, Layers3 } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { courseCatalog } from '@/lib/course-catalog';
import { getAdminCourseCatalog } from '@/lib/admin-course-catalog';

type Props = {
  params: Promise<{ formationSlug: string }>;
};

type CourseStatus = {
  quizDone: boolean;
  challengeDone: boolean;
  validated: boolean;
};

const DEFAULT_STATUS: CourseStatus = {
  quizDone: false,
  challengeDone: false,
  validated: false,
};

function extractCourseSlug(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).courseSlug;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'formation';
}

function getMissingSteps(status: CourseStatus) {
  const missing: string[] = [];
  if (!status.quizDone) missing.push('Faire le quiz');
  if (!status.challengeDone) missing.push('Faire le mini challenge');
  return missing;
}

export default async function FormationCoursesPage({ params }: Props) {
  const { formationSlug } = await params;
  const adminCourses = await getAdminCourseCatalog();
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId: string | null = null;
  if (isAuthDisabled) {
    clerkId = 'local';
  } else {
    const authData = await auth();
    clerkId = authData.userId ?? null;
  }

  const courseStatusMap = new Map<string, CourseStatus>();

  if (clerkId) {
    try {
      const events = await prisma.learningEvent.findMany({
        where: {
          clerkId,
          action: {
            in: ['quiz_passed', 'quiz_failed', 'mini_challenge_submitted'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: {
          action: true,
          status: true,
          metadata: true,
        },
      });

      for (const event of events) {
        const slug = extractCourseSlug(event.metadata);
        if (!slug) continue;

        const current = courseStatusMap.get(slug) ?? { ...DEFAULT_STATUS };

        if (event.action === 'quiz_passed' || event.action === 'quiz_failed') {
          current.quizDone = true;
        }

        if (event.action === 'mini_challenge_submitted' && event.status === 'success') {
          current.challengeDone = true;
        }

        current.validated = current.quizDone && current.challengeDone;
        courseStatusMap.set(slug, current);
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
          description: course.description,
          level: course.level,
          duration: course.duration,
          modulesCount: course.modules,
          formationName: course.formationName || 'Formation générale',
          courseIndex: course.courseIndex,
        }))
      : courseCatalog.map((course) => ({
          slug: course.slug,
          title: course.title,
          description: course.description,
          level: course.level,
          duration: course.duration,
          modulesCount: course.modules.length,
          formationName: 'Formation générale',
          courseIndex: 0,
        }));

  const filtered = cards.filter((course) => slugify(course.formationName) === formationSlug);

  if (filtered.length === 0) {
    notFound();
  }

  const sortedCourses = [...filtered].sort((a, b) => a.courseIndex - b.courseIndex);
  const formationName = sortedCourses[0].formationName;

  const validatedCount = sortedCourses.reduce((count, course) => {
    const status = courseStatusMap.get(course.slug) ?? DEFAULT_STATUS;
    return count + (status.validated ? 1 : 0);
  }, 0);

  const completionPercent = Math.round((validatedCount / sortedCourses.length) * 100);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 lg:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <p className="text-[11px] text-primary font-semibold uppercase tracking-wide">Formation</p>
            <h1 className="text-xl lg:text-2xl font-bold leading-tight">{formationName}</h1>
            <p className="text-xs text-muted-foreground max-w-3xl">Parcours structuré: valide chaque cours avec quiz + mini challenge pour verrouiller les acquis.</p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-md border bg-background px-2 py-1">{sortedCourses.length} cours</span>
            <span className="rounded-md border bg-primary/10 border-primary/30 px-2 py-1 text-primary">{validatedCount} validés</span>
            <span className="rounded-md border bg-background px-2 py-1">{completionPercent}%</span>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
        </div>

        <Link href="/courses" className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent">
          <Layers3 className="h-3.5 w-3.5" /> Retour aux formations
        </Link>
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b bg-background/60 text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
          Cours de la formation
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {sortedCourses.map((course) => {
            const status = courseStatusMap.get(course.slug) ?? DEFAULT_STATUS;
            const missingSteps = getMissingSteps(status);

            return (
              <article key={course.slug} className="rounded-lg border bg-background p-3 space-y-2.5 hover:bg-accent/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">#{course.courseIndex}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.validated ? 'border-primary/40 bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
                    {status.validated && <CheckCircle2 className="h-3 w-3" />}
                    {status.validated ? 'Validé' : 'En cours'}
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="font-semibold text-sm leading-tight line-clamp-2">{course.title}</h2>
                  <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {course.level}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {course.duration}</span>
                  <span>{course.modulesCount} modules</span>
                </div>

                {!status.validated && (
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><CircleAlert className="h-3 w-3" /> {missingSteps.join(' • ')}</p>
                )}

                <Link
                  href={`/courses/${course.slug}`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                >
                  Ouvrir le cours
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
