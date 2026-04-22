import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { promises as fs } from 'fs';
import path from 'path';

type LocalProgressRecord = {
  type: 'quiz' | 'challenge' | 'reflection';
  clerkId: string;
  courseSlug: string;
  courseTitle?: string;
  score?: number;
  totalQuestions?: number;
  passed?: boolean;
  status?: string;
  createdAt: string;
};

const LOCAL_PROGRESS_FILE = path.join(process.cwd(), '.local-ai-progress.json');

async function readLocalProgress(): Promise<LocalProgressRecord[]> {
  try {
    const raw = await fs.readFile(LOCAL_PROGRESS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalProgressRecord[]) : [];
  } catch {
    return [];
  }
}

function buildProfileFromLocal(localRecords: LocalProgressRecord[], clerkId: string, includeAll = false) {
  const mine = includeAll ? localRecords : localRecords.filter((r) => r.clerkId === clerkId);
  const quizAttempts = mine.filter((r) => r.type === 'quiz');
  const challengeAttempts = mine.filter((r) => r.type === 'challenge');

  const quizBySlug = new Map<string, { attempts: number; totalScore: number; totalMax: number; passed: number }>();
  for (const attempt of quizAttempts) {
    const entry = quizBySlug.get(attempt.courseSlug) ?? { attempts: 0, totalScore: 0, totalMax: 0, passed: 0 };
    entry.attempts += 1;
    entry.totalScore += Number(attempt.score ?? 0);
    entry.totalMax += Number(attempt.totalQuestions ?? 1);
    if (attempt.passed) entry.passed += 1;
    quizBySlug.set(attempt.courseSlug, entry);
  }

  const quizStats = Array.from(quizBySlug.entries()).map(([slug, data]) => ({
    slug,
    attempts: data.attempts,
    avgScore: data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0,
    passRate: data.attempts > 0 ? Math.round((data.passed / data.attempts) * 100) : 0,
  }));

  const challengeBySlug = new Map<string, { attempts: number; passed: number }>();
  for (const attempt of challengeAttempts) {
    const entry = challengeBySlug.get(attempt.courseSlug) ?? { attempts: 0, passed: 0 };
    entry.attempts += 1;
    if (attempt.status === 'success' || attempt.passed === true) entry.passed += 1;
    challengeBySlug.set(attempt.courseSlug, entry);
  }

  const challengeStats = Array.from(challengeBySlug.entries()).map(([slug, data]) => ({
    slug,
    attempts: data.attempts,
    passRate: data.attempts > 0 ? Math.round((data.passed / data.attempts) * 100) : 0,
  }));

  const strong = quizStats
    .filter((s) => s.passRate >= 70)
    .sort((a, b) => b.passRate - a.passRate)
    .slice(0, 5)
    .map((s) => s.slug);

  const weak = quizStats
    .filter((s) => s.passRate < 70)
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 5)
    .map((s) => s.slug);

  const challengeWeak = challengeStats
    .filter((s) => s.passRate < 60)
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 3)
    .map((s) => s.slug);

  return {
    ok: true,
    fallback: true,
    fallbackSource: 'local_file',
    user: { name: 'Étudiant', level: 'débutant' },
    stats: {
      totalQuizPassed: quizAttempts.filter((a) => a.passed).length,
      totalChallengeSuccess: challengeAttempts.filter((a) => a.status === 'success' || a.passed === true).length,
      avgProgress: 0,
      successRate: mine.length > 0 ? Math.round(((quizAttempts.filter((a) => a.passed).length + challengeAttempts.filter((a) => a.status === 'success' || a.passed === true).length) / mine.length) * 100) : 0,
      totalEvents: mine.length,
    },
    quizStats,
    challengeStats,
    profile: {
      strong,
      weak: [...new Set([...weak, ...challengeWeak])].slice(0, 5),
      recentTopics: Array.from(new Set(mine.slice().reverse().map((r) => r.courseSlug))).slice(0, 5),
    },
  };
}

export async function GET() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId = 'local';
  if (isAuthDisabled) {
    try {
      const latestKnownUser = await prisma.user.findFirst({
        where: { clerkId: { not: '' } },
        orderBy: { createdAt: 'desc' },
        select: { clerkId: true },
      });
      if (latestKnownUser?.clerkId) {
        clerkId = latestKnownUser.clerkId;
      }
    } catch {
      // keep local fallback
    }
  } else {
    const authData = await auth();
    if (!authData.userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    clerkId = authData.userId;
  }

  try {
    const user = await prisma.user
      .findUnique({
        where: { clerkId },
        select: { id: true, displayName: true, level: true },
      })
      .catch(() => null);

    const userId = user?.id ?? null;

    const quizAttemptsDb = await prisma.courseQuizAttempt
      .findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { courseSlug: true, score: true, totalQuestions: true, passed: true, createdAt: true },
      })
      .catch(() => []);

    const challengeAttemptsDb = await prisma.courseChallengeAttempt
      .findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { courseSlug: true, status: true, createdAt: true },
      })
      .catch(() => []);

    const localRecords = await readLocalProgress();
    const localMine = isAuthDisabled ? localRecords : localRecords.filter((r) => r.clerkId === clerkId);

    const quizAttempts = [
      ...quizAttemptsDb,
      ...localMine
        .filter((r) => r.type === 'quiz')
        .map((r) => ({
          courseSlug: r.courseSlug,
          score: Number(r.score ?? 0),
          totalQuestions: Number(r.totalQuestions ?? 1),
          passed: Boolean(r.passed),
          createdAt: new Date(r.createdAt),
        })),
    ];

    const challengeAttempts = [
      ...challengeAttemptsDb,
      ...localMine
        .filter((r) => r.type === 'challenge')
        .map((r) => ({
          courseSlug: r.courseSlug,
          status: r.status ?? (r.passed ? 'success' : 'submitted'),
          createdAt: new Date(r.createdAt),
        })),
    ];

    const courseProgressRows = userId
      ? await prisma.progress
          .findMany({
            where: { userId },
            select: { progressPercentage: true, completedModules: true },
          })
          .catch(() => [])
      : [];

    const learningEvents = await prisma.learningEvent
      .findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { action: true, status: true, feature: true, createdAt: true, metadata: true },
      })
      .catch(() => []);

    // ── Quiz analysis ──────────────────────────────────────────────────────────
    const quizBySlug = new Map<string, { attempts: number; totalScore: number; totalMax: number; passed: number }>();
    for (const attempt of quizAttempts) {
      const entry = quizBySlug.get(attempt.courseSlug) ?? { attempts: 0, totalScore: 0, totalMax: 0, passed: 0 };
      entry.attempts += 1;
      entry.totalScore += Number(attempt.score ?? 0);
      entry.totalMax += Number(attempt.totalQuestions ?? 1);
      if (attempt.passed) entry.passed += 1;
      quizBySlug.set(attempt.courseSlug, entry);
    }

    const quizStats = Array.from(quizBySlug.entries()).map(([slug, data]) => ({
      slug,
      attempts: data.attempts,
      avgScore: data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0,
      passRate: data.attempts > 0 ? Math.round((data.passed / data.attempts) * 100) : 0,
    }));

    // ── Challenge analysis ─────────────────────────────────────────────────────
    const challengeBySlug = new Map<string, { attempts: number; passed: number }>();
    for (const attempt of challengeAttempts) {
      const entry = challengeBySlug.get(attempt.courseSlug) ?? { attempts: 0, passed: 0 };
      entry.attempts += 1;
      if (attempt.status === 'success') entry.passed += 1;
      challengeBySlug.set(attempt.courseSlug, entry);
    }

    const challengeStats = Array.from(challengeBySlug.entries()).map(([slug, data]) => ({
      slug,
      attempts: data.attempts,
      passRate: data.attempts > 0 ? Math.round((data.passed / data.attempts) * 100) : 0,
    }));

    // ── Global stats ──────────────────────────────────────────────────────────
    const totalQuizPassed = quizAttempts.filter((a) => a.passed).length;
    const totalChallengeSuccess = challengeAttempts.filter((a) => a.status === 'success').length;
    const avgProgress =
      courseProgressRows.length > 0
        ? Math.round(courseProgressRows.reduce((s, r) => s + r.progressPercentage, 0) / courseProgressRows.length)
        : 0;
    const successEvents = learningEvents.filter((e) => e.status === 'success').length;
    const totalEvents = learningEvents.length;
    const successRate = totalEvents > 0 ? Math.round((successEvents / totalEvents) * 100) : 0;

    // ── Strong & weak topics ──────────────────────────────────────────────────
    const strong = quizStats
      .filter((s) => s.passRate >= 70)
      .sort((a, b) => b.passRate - a.passRate)
      .slice(0, 5)
      .map((s) => s.slug);

    const weak = quizStats
      .filter((s) => s.passRate < 70)
      .sort((a, b) => a.passRate - b.passRate)
      .slice(0, 5)
      .map((s) => s.slug);

    const challengeWeak = challengeStats
      .filter((s) => s.passRate < 60)
      .sort((a, b) => a.passRate - b.passRate)
      .slice(0, 3)
      .map((s) => s.slug);

    // ── Recent activity ───────────────────────────────────────────────────────
    const recentSlugsSet = new Set<string>();
    for (const event of learningEvents) {
      if (!event.metadata || typeof event.metadata !== 'object') continue;
      const meta = event.metadata as Record<string, unknown>;
      const slug = typeof meta.courseSlug === 'string' ? meta.courseSlug : null;
      if (slug) recentSlugsSet.add(slug);
      if (recentSlugsSet.size >= 5) break;
    }
    const recentTopics = Array.from(recentSlugsSet);

    return Response.json({
      ok: true,
      user: {
        name: user?.displayName ?? 'Étudiant',
        level: user?.level ?? 'débutant',
      },
      stats: {
        totalQuizPassed,
        totalChallengeSuccess,
        avgProgress,
        successRate,
        totalEvents,
      },
      quizStats,
      challengeStats,
      profile: {
        strong,
        weak: [...new Set([...weak, ...challengeWeak])].slice(0, 5),
        recentTopics,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'profile_load_error';
    const local = await readLocalProgress();
    if (local.length > 0) {
      return Response.json({
        ...buildProfileFromLocal(local, clerkId, isAuthDisabled),
        detail,
      });
    }
    return Response.json({
      ok: true,
      fallback: true,
      detail,
      user: { name: 'Étudiant', level: 'débutant' },
      stats: { totalQuizPassed: 0, totalChallengeSuccess: 0, avgProgress: 0, successRate: 0, totalEvents: 0 },
      quizStats: [],
      challengeStats: [],
      profile: { strong: [], weak: [], recentTopics: [] },
    });
  }
}
