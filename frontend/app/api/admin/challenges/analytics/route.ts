import prisma from '@/lib/prisma';
import { getAdminContext } from '@/lib/admin-auth';

type AggStats = {
  attempts: number;
  passed: number;
  scoreSum: number;
  scoreCount: number;
  durationSum: number;
  durationCount: number;
};

function createAgg(): AggStats {
  return {
    attempts: 0,
    passed: 0,
    scoreSum: 0,
    scoreCount: 0,
    durationSum: 0,
    durationCount: 0,
  };
}

function toMetrics(stats: AggStats) {
  return {
    attempts: stats.attempts,
    passRate: stats.attempts > 0 ? Math.round((stats.passed / stats.attempts) * 100) : 0,
    avgScore: stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : 0,
    avgDurationSec: stats.durationCount > 0 ? Math.round(stats.durationSum / stats.durationCount) : 0,
  };
}

function challengeLabel(input: string | null | undefined) {
  const value = String(input ?? '').trim();
  return value || 'Exercice';
}

export async function GET(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(searchParams.get('days') ?? 30) || 30));
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        createdAt: { gte: fromDate },
      },
      select: {
        challengeTitle: true,
        score: true,
        passed: true,
        durationSec: true,
        level: true,
        challenge: {
          select: {
            title: true,
            difficulty: true,
            formation: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5000,
    });

    const summaryAgg = createAgg();
    const byDifficultyMap = new Map<string, AggStats>();
    const byFormationMap = new Map<string, AggStats>();
    const byChallengeMap = new Map<string, AggStats>();

    for (const attempt of attempts) {
      summaryAgg.attempts += 1;
      if (attempt.passed) summaryAgg.passed += 1;
      if (typeof attempt.score === 'number') {
        summaryAgg.scoreSum += attempt.score;
        summaryAgg.scoreCount += 1;
      }
      if (typeof attempt.durationSec === 'number' && attempt.durationSec > 0) {
        summaryAgg.durationSum += attempt.durationSec;
        summaryAgg.durationCount += 1;
      }

      const difficulty =
        (attempt.challenge?.difficulty || attempt.level || '').trim() ||
        'non classé';
      const formation = (attempt.challenge?.formation?.name || '').trim() || 'Sans formation';
      const challengeTitle = challengeLabel(attempt.challenge?.title || attempt.challengeTitle);

      const difficultyAgg = byDifficultyMap.get(difficulty) ?? createAgg();
      difficultyAgg.attempts += 1;
      if (attempt.passed) difficultyAgg.passed += 1;
      if (typeof attempt.score === 'number') {
        difficultyAgg.scoreSum += attempt.score;
        difficultyAgg.scoreCount += 1;
      }
      byDifficultyMap.set(difficulty, difficultyAgg);

      const formationAgg = byFormationMap.get(formation) ?? createAgg();
      formationAgg.attempts += 1;
      if (attempt.passed) formationAgg.passed += 1;
      if (typeof attempt.score === 'number') {
        formationAgg.scoreSum += attempt.score;
        formationAgg.scoreCount += 1;
      }
      byFormationMap.set(formation, formationAgg);

      const challengeAgg = byChallengeMap.get(challengeTitle) ?? createAgg();
      challengeAgg.attempts += 1;
      if (attempt.passed) challengeAgg.passed += 1;
      if (typeof attempt.score === 'number') {
        challengeAgg.scoreSum += attempt.score;
        challengeAgg.scoreCount += 1;
      }
      byChallengeMap.set(challengeTitle, challengeAgg);
    }

    const byDifficulty = Array.from(byDifficultyMap.entries())
      .map(([difficulty, agg]) => ({
        difficulty,
        ...toMetrics(agg),
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 6);

    const byFormation = Array.from(byFormationMap.entries())
      .map(([formation, agg]) => ({
        formation,
        ...toMetrics(agg),
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    const topChallenges = Array.from(byChallengeMap.entries())
      .map(([title, agg]) => ({
        title,
        ...toMetrics(agg),
      }))
      .sort((a, b) => {
        if (b.attempts !== a.attempts) return b.attempts - a.attempts;
        return b.avgScore - a.avgScore;
      })
      .slice(0, 8);

    return Response.json({
      ok: true,
      days,
      summary: toMetrics(summaryAgg),
      byDifficulty,
      byFormation,
      topChallenges,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'analytics_error';
    return Response.json({ ok: false, error: 'analytics_error', detail }, { status: 500 });
  }
}
