import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

function parseFormationName(topics: unknown) {
  if (!topics || typeof topics !== 'object' || Array.isArray(topics)) {
    return 'Formation générale';
  }
  const payload = topics as { formationName?: unknown };
  return typeof payload.formationName === 'string' && payload.formationName.trim()
    ? payload.formationName.trim()
    : 'Formation générale';
}

function badgeCatalog(input: {
  totalEvents: number;
  successfulEvents: number;
  quizPassed: number;
  streakSignals: number;
  avgProgress: number;
}) {
  const badges = [] as Array<{ key: string; label: string; unlocked: boolean; reason: string }>;

  badges.push({
    key: 'first_step',
    label: 'Premier Pas',
    unlocked: input.totalEvents >= 1,
    reason: 'Réaliser au moins une action dans la plateforme.',
  });

  badges.push({
    key: 'consistency',
    label: 'Régularité',
    unlocked: input.streakSignals >= 3,
    reason: 'Avoir au moins 3 sessions actives détectées.',
  });

  badges.push({
    key: 'quiz_master',
    label: 'Quiz Master',
    unlocked: input.quizPassed >= 3,
    reason: 'Valider 3 checkpoints quiz.',
  });

  badges.push({
    key: 'steady_progress',
    label: 'Progression Solide',
    unlocked: input.avgProgress >= 60,
    reason: 'Atteindre 60% de progression moyenne.',
  });

  badges.push({
    key: 'precision_runner',
    label: 'Précision',
    unlocked: input.totalEvents > 0 && (input.successfulEvents / input.totalEvents) >= 0.7,
    reason: 'Maintenir un taux de succès >= 70%.',
  });

  return badges;
}

export async function GET() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId = 'local';
  if (!isAuthDisabled) {
    const authData = await auth();
    if (!authData.userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    clerkId = authData.userId;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, displayName: true, level: true, email: true },
    });

    if (!user && !isAuthDisabled) {
      return Response.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    const userId = user?.id ?? null;

    const [events, progresses, courses, settingsEvent] = await Promise.all([
      prisma.learningEvent.findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: {
          action: true,
          status: true,
          createdAt: true,
          feature: true,
        },
      }),
      userId
        ? prisma.progress.findMany({
            where: { userId },
            orderBy: { lastAccessed: 'desc' },
            select: {
              courseId: true,
              progressPercentage: true,
              completedModules: true,
              lastAccessed: true,
            },
          })
        : Promise.resolve([]),
      prisma.course.findMany({
        select: {
          id: true,
          title: true,
          level: true,
          topics: true,
        },
      }),
      prisma.learningEvent.findFirst({
        where: { feature: 'admin_training_settings', action: 'save' },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      }),
    ]);

    const courseById = new Map(courses.map((course) => [course.id, course]));

    const totalEvents = events.length;
    const successfulEvents = events.filter((event) => event.status === 'success').length;
    const failedEvents = events.filter((event) => event.status === 'error').length;
    const quizPassed = events.filter((event) => event.action === 'quiz_passed').length;

    const sessionDays = new Set(events.map((event) => event.createdAt.toISOString().slice(0, 10)));
    const streakSignals = sessionDays.size;

    const avgProgress =
      progresses.length > 0
        ? Number((progresses.reduce((acc, item) => acc + item.progressPercentage, 0) / progresses.length).toFixed(1))
        : 0;

    const badges = badgeCatalog({
      totalEvents,
      successfulEvents,
      quizPassed,
      streakSignals,
      avgProgress,
    });

    const unlockedBadges = badges.filter((badge) => badge.unlocked).length;

    const settings = (settingsEvent?.metadata && typeof settingsEvent.metadata === 'object'
      ? settingsEvent.metadata
      : {}) as {
      weeklyGoalHours?: unknown;
      passThreshold?: unknown;
      programName?: unknown;
    };

    const weeklyGoalHours = Math.max(1, Math.min(40, Number(settings.weeklyGoalHours ?? 5)));
    const passThreshold = Math.max(0, Math.min(100, Number(settings.passThreshold ?? 70)));

    const objectives = [
      {
        key: 'weekly_goal',
        label: `Atteindre ${weeklyGoalHours}h d'apprentissage cette semaine`,
        progress: Math.min(100, Math.round((sessionDays.size / Math.max(1, weeklyGoalHours)) * 100)),
      },
      {
        key: 'success_rate',
        label: `Maintenir un taux de réussite >= ${passThreshold}%`,
        progress:
          totalEvents > 0
            ? Math.min(100, Math.round((successfulEvents / totalEvents) * 100))
            : 0,
      },
      {
        key: 'progress_avg',
        label: 'Atteindre 80% de progression moyenne',
        progress: Math.min(100, Math.round((avgProgress / 80) * 100)),
      },
    ];

    const orderedProgress = [...progresses].sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    const resumeItem = orderedProgress[0];

    const doneCourseIds = new Set(
      progresses.filter((item) => item.progressPercentage >= 95).map((item) => item.courseId)
    );

    const nextCourse = courses
      .filter((course) => !doneCourseIds.has(course.id))
      .sort((a, b) => a.title.localeCompare(b.title))[0];

    const recommendation = nextCourse
      ? {
          type: 'next_best_lesson',
          courseId: nextCourse.id,
          title: nextCourse.title,
          level: nextCourse.level,
          formationName: parseFormationName(nextCourse.topics),
          reason: 'Cours non finalisé avec fort potentiel pédagogique pour la prochaine session.',
        }
      : {
          type: 'review',
          title: 'Révision globale',
          reason: 'Tous les cours semblent bien avancés. Passe en mode consolidation.',
        };

    const resume = resumeItem
      ? {
          type: 'resume_intelligent',
          courseId: resumeItem.courseId,
          title: courseById.get(resumeItem.courseId)?.title ?? 'Cours en cours',
          lastProgress: resumeItem.progressPercentage,
          lastAccessed: resumeItem.lastAccessed,
          suggestion: 'Reprendre ce cours en priorité pour capitaliser sur le contexte encore frais.',
        }
      : {
          type: 'resume_intelligent',
          title: 'Aucun historique détecté',
          suggestion: 'Commence par un premier cours pour initier ta progression personnalisée.',
        };

    return Response.json({
      ok: true,
      promptVersion: 'v2.1',
      learner: {
        name: user?.displayName ?? 'Utilisateur local',
        level: user?.level ?? 'débutant',
        email: user?.email ?? '-',
      },
      metrics: {
        totalEvents,
        successfulEvents,
        failedEvents,
        avgProgress,
        unlockedBadges,
        totalBadges: badges.length,
      },
      badges,
      objectives,
      recommendation,
      resume,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'progression_error';
    return Response.json({ ok: false, error: 'progression_error', detail }, { status: 500 });
  }
}
