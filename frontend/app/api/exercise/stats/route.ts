import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { computeLevel, THRESHOLDS } from '../_lib/progression';
import { isTransientPrismaError, withPrismaRetry } from '../_lib/prisma-retry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId: string | null = null;
  if (!isAuthDisabled) {
    try {
      const authData = await auth();
      clerkId = authData.userId ?? null;
    } catch {
      // noop
    }
  } else {
    clerkId = 'local';
  }

  if (!clerkId) {
    return Response.json({ detail: 'unauthenticated' }, { status: 401 });
  }

  try {
    const session = await withPrismaRetry(() => prisma.exerciseSession.findUnique({ where: { clerkId } }));

    if (!session) {
      return Response.json({
        level: 'debutant',
        difficulty: 1,
        totalPoints: 0,
        passedCount: 0,
        failedCount: 0,
        consecutiveWins: 0,
        nextLevelPoints: THRESHOLDS.debutant.points,
        nextLevelPassed: THRESHOLDS.debutant.passed,
      });
    }

    const level = computeLevel(session.totalPoints, session.passedCount);
    const isMaxLevel = level === 'avance';
    const nextThresholdKey = level === 'debutant' ? 'debutant' : 'intermediaire';

    return Response.json({
      level,
      difficulty: session.difficulty,
      totalPoints: session.totalPoints,
      passedCount: session.passedCount,
      failedCount: session.failedCount,
      consecutiveWins: session.consecutiveWins,
      nextLevelPoints: isMaxLevel ? null : THRESHOLDS[nextThresholdKey].points,
      nextLevelPassed: isMaxLevel ? null : THRESHOLDS[nextThresholdKey].passed,
    });
  } catch (err) {
    console.error('[exercise/stats] error:', err);
    if (isTransientPrismaError(err)) {
      return Response.json({
        level: 'debutant',
        difficulty: 1,
        totalPoints: 0,
        passedCount: 0,
        failedCount: 0,
        consecutiveWins: 0,
        nextLevelPoints: THRESHOLDS.debutant.points,
        nextLevelPassed: THRESHOLDS.debutant.passed,
      });
    }
    return Response.json({ detail: 'server_error' }, { status: 500 });
  }
}
