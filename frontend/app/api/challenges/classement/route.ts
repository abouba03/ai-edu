import prisma from '@/lib/prisma';

type LeaderboardRow = {
  clerkId: string;
  displayName: string;
  totalPoints: number;
  attempts: number;
  passed: number;
  passRate: number;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(searchParams.get('days') ?? 30) || 30));
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        createdAt: { gte: fromDate },
        clerkId: { not: null },
      },
      select: {
        clerkId: true,
        score: true,
        passed: true,
      },
    });

    const users = await prisma.user.findMany({
      where: {
        clerkId: {
          in: attempts
            .map((attempt) => attempt.clerkId)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: {
        clerkId: true,
        displayName: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.clerkId, user]));
    const agg = new Map<string, { totalPoints: number; attempts: number; passed: number }>();

    for (const attempt of attempts) {
      const clerkId = attempt.clerkId;
      if (!clerkId) continue;

      const current = agg.get(clerkId) ?? { totalPoints: 0, attempts: 0, passed: 0 };
      current.totalPoints += Math.max(0, attempt.score ?? 0);
      current.attempts += 1;
      if (attempt.passed) current.passed += 1;
      agg.set(clerkId, current);
    }

    const leaderboard: LeaderboardRow[] = Array.from(agg.entries())
      .map(([clerkId, stats]) => {
        const user = userMap.get(clerkId);
        const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Étudiant';
        const passRate = stats.attempts > 0 ? Math.round((stats.passed / stats.attempts) * 100) : 0;

        return {
          clerkId,
          displayName,
          totalPoints: stats.totalPoints,
          attempts: stats.attempts,
          passed: stats.passed,
          passRate,
        };
      })
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.passRate !== a.passRate) return b.passRate - a.passRate;
        return b.passed - a.passed;
      })
      .slice(0, 50);

    return Response.json({ ok: true, days, leaderboard });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'classement_error';
    return Response.json({ ok: true, days, leaderboard: [], degraded: true, detail });
  }
}
