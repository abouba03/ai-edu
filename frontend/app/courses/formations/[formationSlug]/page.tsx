import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, CircleAlert, Clock3, GraduationCap, Layers3, ArrowLeft } from 'lucide-react';
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
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'formation'
  );
}

function getMissingSteps(status: CourseStatus) {
  const missing: string[] = [];
  if (!status.quizDone) missing.push('Quiz');
  if (!status.challengeDone) missing.push('Mini challenge');
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
          action: { in: ['quiz_passed', 'quiz_failed', 'mini_challenge_submitted'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: { action: true, status: true, metadata: true },
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

  if (filtered.length === 0) notFound();

  const sortedCourses = [...filtered].sort((a, b) => a.courseIndex - b.courseIndex);
  const formationName = sortedCourses[0].formationName;

  const validatedCount = sortedCourses.reduce((count, course) => {
    const status = courseStatusMap.get(course.slug) ?? DEFAULT_STATUS;
    return count + (status.validated ? 1 : 0);
  }, 0);

  const completionPercent = Math.round((validatedCount / sortedCourses.length) * 100);

  return (
    <div className="space-y-5">

      {/* ── EN-TÊTE FORMATION ── */}
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-5 lg:p-6 shadow-[5px_5px_0px_0px_#1C293C]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

          <div className="space-y-2 max-w-2xl">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
              Formation
            </p>
            <h1 className="text-2xl lg:text-3xl font-black text-[#1C293C] leading-tight">
              {formationName}
            </h1>
            <p className="text-sm font-medium text-[#1C293C]/60 leading-relaxed">
              Parcours structuré — valide chaque cours avec quiz + mini challenge pour verrouiller les acquis.
            </p>
          </div>

          {/* Stats bloc */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="border-2 border-[#1C293C] bg-white px-4 py-2.5 text-center shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/60">Cours</p>
              <p className="text-2xl font-black text-[#1C293C]">{sortedCourses.length}</p>
            </div>
            <div className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2.5 text-center shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/70">Validés</p>
              <p className="text-2xl font-black text-[#1C293C]">{validatedCount}</p>
            </div>
            <div className="border-2 border-[#1C293C] bg-white px-4 py-2.5 text-center shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/60">Progression</p>
              <p className="text-2xl font-black text-[#1C293C]">{completionPercent}%</p>
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#1C293C]/60">
            <span>{validatedCount} cours validés sur {sortedCourses.length}</span>
            <span>{completionPercent}%</span>
          </div>
          <div className="h-2 border border-[#1C293C] bg-white overflow-hidden">
            <div
              className="h-full bg-[#1C293C] transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Retour */}
        <div className="mt-4">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux formations
          </Link>
        </div>
      </section>

      {/* ── GRILLE DES COURS ── */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
            Cours de la formation
          </p>
          <span className="border border-[#1C293C]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">
            {sortedCourses.length} cours
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedCourses.map((course) => {
            const status = courseStatusMap.get(course.slug) ?? DEFAULT_STATUS;
            const missingSteps = getMissingSteps(status);

            return (
              <article
                key={course.slug}
                className={`border-2 border-[#1C293C] bg-white p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_#1C293C] hover:shadow-[2px_2px_0px_0px_#1C293C] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 ${
                  status.validated ? 'border-l-4 border-l-[#16A34A]' : ''
                }`}
              >
                {/* Course header */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-black text-[#1C293C]/40 border border-[#1C293C]/20 px-1.5 py-0.5">
                    #{course.courseIndex}
                  </span>
                  {status.validated ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#16A34A]">
                      <CheckCircle2 className="h-3 w-3" /> Validé
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-[#1C293C]/40">
                      En cours
                    </span>
                  )}
                </div>

                {/* Title + description */}
                <div className="space-y-1 flex-1">
                  <h2 className="font-black text-sm text-[#1C293C] leading-tight line-clamp-2">
                    {course.title}
                  </h2>
                  <p className="text-xs font-medium text-[#1C293C]/55 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-[#1C293C]/50">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> {course.level}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {course.duration}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers3 className="h-3 w-3" /> {course.modulesCount} module{course.modulesCount > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Étapes manquantes */}
                {!status.validated && missingSteps.length > 0 && (
                  <p className="text-[11px] font-semibold text-[#1C293C]/40 inline-flex items-center gap-1">
                    <CircleAlert className="h-3 w-3 shrink-0" />
                    Manque : {missingSteps.join(' + ')}
                  </p>
                )}

                {/* CTA */}
                <Link
                  href={`/courses/${course.slug}`}
                  className={`inline-flex w-full items-center justify-center border-2 border-[#1C293C] px-3 py-2 text-xs font-black transition-all duration-100 shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] ${
                    status.validated
                      ? 'bg-white text-[#1C293C]'
                      : 'bg-[#FDC800] text-[#1C293C]'
                  }`}
                >
                  {status.validated ? 'Revoir le cours' : 'Ouvrir le cours'}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
