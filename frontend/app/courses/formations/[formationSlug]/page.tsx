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
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-wide">Formation</p>
            <h1 className="text-2xl lg:text-3xl font-bold mt-1">{formationName}</h1>
            <p className="text-sm text-muted-foreground mt-2">Choisis un cours pour commencer, puis valide-le avec le quiz et le mini challenge.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 min-w-[250px] text-xs">
            <div className="rounded-lg border bg-background p-2.5">
              <p className="text-muted-foreground">Cours</p>
              <p className="font-semibold text-sm">{sortedCourses.length}</p>
            </div>
            <div className="rounded-lg border bg-primary/10 border-primary/30 p-2.5">
              <p className="text-muted-foreground">Validés</p>
              <p className="font-semibold text-sm text-primary">{validatedCount}</p>
            </div>
            <div className="rounded-lg border bg-background p-2.5">
              <p className="text-muted-foreground">Progression</p>
              <p className="font-semibold text-sm">{completionPercent}%</p>
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
        </div>

        <div className="mt-4">
          <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            <Layers3 className="h-4 w-4" /> Retour aux formations
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {sortedCourses.map((course) => {
          const status = courseStatusMap.get(course.slug) ?? DEFAULT_STATUS;
          const missingSteps = getMissingSteps(status);

          return (
            <article key={course.slug} className={`rounded-xl border p-4 space-y-3 ${status.validated ? 'border-primary/30 bg-primary/10' : 'bg-card'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Cours #{course.courseIndex}</p>
                  <h2 className="font-semibold leading-tight line-clamp-2">{course.title}</h2>
                  <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.validated ? 'border-primary/40 bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
                  {status.validated && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {status.validated ? 'Validé' : 'En cours'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {course.level}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {course.duration}</span>
                <span>{course.modulesCount} modules</span>
              </div>

              {status.validated ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Cours validé
                </div>
              ) : (
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                  <CircleAlert className="h-4 w-4" /> Reste: {missingSteps.join(' • ')}
                </div>
              )}

              <Link
                href={`/courses/${course.slug}`}
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Ouvrir le cours
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
