import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookMarked, CirclePlay, Code2, Clock3, Lightbulb, Sparkles } from 'lucide-react';
import { getCourseBySlug } from '@/lib/course-catalog';
import { getAdminCourseBySlug, getFormationProgressBySlug, toYouTubeResources } from '@/lib/admin-course-catalog';
import PersonalizedCoursePanel from '@/components/courses/personalized-course-panel';

type Props = {
  params: Promise<{ slug: string }>;
};

function lessonIcon(type: 'concept' | 'practice' | 'video') {
  if (type === 'video') return <CirclePlay className="h-4 w-4" />;
  if (type === 'practice') return <Code2 className="h-4 w-4" />;
  return <Lightbulb className="h-4 w-4" />;
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const adminCourse = await getAdminCourseBySlug(slug);

  if (adminCourse) {
    const resources = toYouTubeResources(adminCourse.videoLinks);
    const progression = await getFormationProgressBySlug(slug);

    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl border bg-card p-6 lg:p-8 space-y-5">
          <div className="absolute -top-24 right-0 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 size-72 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative space-y-4">
            <p className="text-sm text-primary font-semibold inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Cours vidéo premium (Admin)
            </p>
            <h1 className="text-2xl lg:text-4xl font-bold leading-tight">{adminCourse.title}</h1>
            <p className="text-muted-foreground text-base">{adminCourse.description}</p>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-3 py-1.5">Formation: {adminCourse.formationName}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-3 py-1.5">Cours #{adminCourse.courseIndex}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-3 py-1.5">Niveau: {adminCourse.level}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-3 py-1.5"><Clock3 className="h-3 w-3" /> {adminCourse.duration}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background/70 px-3 py-1.5"><BookMarked className="h-3 w-3" /> {adminCourse.modules} modules</span>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/admin/formation" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                Gérer ce cours dans l’admin
              </Link>
              <Link href="/courses" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Retour aux cours
              </Link>
            </div>
          </div>
        </section>

        <PersonalizedCoursePanel
          courseSlug={slug}
          courseTitle={adminCourse.title}
          courseDescription={adminCourse.description}
          courseLevel={adminCourse.level}
          formationName={adminCourse.formationName}
          courseNumber={progression?.courseNumber ?? adminCourse.courseIndex}
          totalCourses={progression?.totalCourses ?? 1}
          progressPercent={progression?.progressPercent ?? 100}
          nextCourseSlug={progression?.nextCourseSlug ?? null}
          nextCourseTitle={progression?.nextCourseTitle ?? null}
          videoResources={resources}
        />

      </div>
    );
  }

  const course = getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 lg:p-8 space-y-4">
        <p className="text-sm text-primary font-semibold">Parcours pédagogique</p>
        <h1 className="text-2xl lg:text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground">{course.description}</p>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">Niveau: {course.level}</span>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1"><Clock3 className="h-3 w-3" /> {course.duration}</span>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1"><BookMarked className="h-3 w-3" /> {course.modules.length} modules</span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Objectifs du cours</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {course.objectives.map((objective) => (
              <li key={objective}>• {objective}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Prérequis</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {course.prerequisites.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </section>

      {course.playlistId && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Playlist officielle du cours</h2>
          <p className="text-sm text-muted-foreground">
            Suis les vidéos dans l’ordre pour compléter les leçons de la plateforme.
          </p>
          <div className="rounded-lg overflow-hidden border bg-background">
            <iframe
              className="w-full aspect-video"
              src={`https://www.youtube-nocookie.com/embed/videoseries?list=${course.playlistId}`}
              title={`Playlist ${course.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          {course.playlistUrl && (
            <a
              href={course.playlistUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Ouvrir la playlist sur YouTube
            </a>
          )}
        </section>
      )}

      <section className="space-y-4">
        {course.modules.map((module, index) => (
          <article key={module.id} className="rounded-2xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-xs text-primary font-semibold">Module {index + 1}</p>
              <h3 className="text-lg font-semibold mt-1">{module.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
            </div>

            <div className="space-y-3">
              {module.lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-medium inline-flex items-center gap-2">{lessonIcon(lesson.type)} {lesson.title}</p>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {lesson.durationMin} min</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{lesson.summary}</p>

                  {lesson.type === 'video' && lesson.youtubeId && (
                    <div className="rounded-lg overflow-hidden border bg-background">
                      <iframe
                        className="w-full aspect-video"
                        src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}`}
                        title={lesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-5 flex flex-wrap gap-3">
        <Link href="/generator" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
          Pratiquer avec le Générateur
        </Link>
        <Link href="/debugger" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Aller au Débogueur
        </Link>
        <Link href="/challenges" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Faire un Défi
        </Link>
      </section>
    </div>
  );
}
