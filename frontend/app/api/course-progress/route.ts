import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';

type QuizPayload = {
  type: 'quiz';
  actorClerkId?: string;
  courseSlug: string;
  courseTitle?: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  answers?: unknown;
  questions?: unknown;
};

type ChallengePayload = {
  type: 'challenge';
  actorClerkId?: string;
  courseSlug: string;
  courseTitle?: string;
  challengeText?: string;
  submittedCode: string;
  evaluation?: unknown;
  status?: string;
};

type ReflectionPayload = {
  type: 'reflection';
  actorClerkId?: string;
  courseSlug: string;
  courseTitle?: string;
  understood?: string;
  unclear?: string;
};

type ProgressPayload = QuizPayload | ChallengePayload | ReflectionPayload;

async function getActor() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  try {
    const authData = await auth();
    if (authData.userId) {
      const clerkId = authData.userId;
      const user = await prisma.user.findUnique({ where: { clerkId } });
      return {
        clerkId,
        userId: user?.id ?? null,
      };
    }
  } catch {
    // fallback handled below
  }

  if (isAuthDisabled) {
    return { clerkId: 'local' as string | null, userId: null as string | null };
  }

  return { clerkId: null, userId: null };
}

async function resolveActorWithFallback(actorClerkId?: string) {
  const actor = await getActor();
  if (actor.clerkId && actor.clerkId !== 'local') {
    return actor;
  }

  if (actorClerkId && actorClerkId.trim()) {
    const normalized = actorClerkId.trim();
    try {
      const user = await prisma.user.findUnique({ where: { clerkId: normalized } });
      return {
        clerkId: normalized,
        userId: user?.id ?? null,
      };
    } catch {
      return {
        clerkId: normalized,
        userId: null,
      };
    }
  }

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
    try {
      const latestKnownUser = await prisma.user.findFirst({
        where: {
          clerkId: {
            not: '',
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (latestKnownUser?.clerkId) {
        return {
          clerkId: latestKnownUser.clerkId,
          userId: latestKnownUser.id,
        };
      }
    } catch {
      // keep local fallback
    }
  }

  return actor;
}

export async function POST(req: Request) {
  let payload: ProgressPayload;
  try {
    payload = (await req.json()) as ProgressPayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!payload?.type || !payload?.courseSlug) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const actor = await resolveActorWithFallback(payload.actorClerkId);
  if (!actor.clerkId || actor.clerkId === 'local') {
    return Response.json(
      {
        ok: false,
        error: 'missing_authenticated_user',
        detail: 'Aucun utilisateur Clerk réel détecté. Connecte-toi avant de sauvegarder la progression.',
      },
      { status: 401 }
    );
  }

  try {
    if (payload.type === 'quiz') {
      await prisma.courseQuizAttempt.create({
        data: {
          clerkId: actor.clerkId,
          userId: actor.userId,
          courseSlug: payload.courseSlug,
          courseTitle: payload.courseTitle,
          score: payload.score,
          totalQuestions: payload.totalQuestions,
          passed: payload.passed,
          answers: payload.answers === undefined ? Prisma.JsonNull : (payload.answers as Prisma.InputJsonValue),
          questions: payload.questions === undefined ? Prisma.JsonNull : (payload.questions as Prisma.InputJsonValue),
        },
      });
    }

    if (payload.type === 'challenge') {
      await prisma.courseChallengeAttempt.create({
        data: {
          clerkId: actor.clerkId,
          userId: actor.userId,
          courseSlug: payload.courseSlug,
          courseTitle: payload.courseTitle,
          challengeText: payload.challengeText,
          submittedCode: payload.submittedCode,
          evaluation: payload.evaluation === undefined ? Prisma.JsonNull : (payload.evaluation as Prisma.InputJsonValue),
          status: payload.status ?? 'submitted',
        },
      });
    }

    if (payload.type === 'reflection') {
      await prisma.courseReflection.create({
        data: {
          clerkId: actor.clerkId,
          userId: actor.userId,
          courseSlug: payload.courseSlug,
          courseTitle: payload.courseTitle,
          understood: payload.understood,
          unclear: payload.unclear,
        },
      });
    }

    return Response.json({ ok: true, actor });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database_error';
    return Response.json({ ok: false, skipped: true, reason: 'database_unavailable', detail: message }, { status: 200 });
  }
}
