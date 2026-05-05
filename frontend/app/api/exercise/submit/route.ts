import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { computeLevel, THRESHOLDS } from '../_lib/progression';
import { isTransientPrismaError, withPrismaRetry } from '../_lib/prisma-retry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubmitRequest = {
  challenge_description?: string;
  challenge_json?: Record<string, unknown>;
  challenge_tests?: Record<string, unknown> | null;
  student_code?: string;
  difficulty?: number;
};

function clampScore(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function extractScore(evalJson: unknown, fallback: string): number {
  if (evalJson && typeof evalJson === 'object') {
    const summary = (evalJson as Record<string, unknown>).test_summary;
    if (summary && typeof summary === 'object') {
      const total = Number((summary as Record<string, unknown>).total ?? 0);
      const passed = Number((summary as Record<string, unknown>).passed ?? 0);
      if (Number.isFinite(total) && total > 0 && Number.isFinite(passed)) {
        return clampScore((passed / total) * 100);
      }
    }

    const raw = (evalJson as Record<string, unknown>).note;
    if (typeof raw === 'number' && Number.isFinite(raw)) return clampScore((raw / 10) * 100);
    if (typeof raw === 'string') {
      const parsed = Number(raw.replace(',', '.').replace('/10', ''));
      if (Number.isFinite(parsed)) return clampScore((parsed / 10) * 100);
    }
  }
  const m = fallback.match(/note\s*[:=]\s*(\d+(?:[\.,]\d+)?)/i);
  if (m?.[1]) {
    const parsed = Number(m[1].replace(',', '.'));
    if (Number.isFinite(parsed)) return clampScore((parsed / 10) * 100);
  }
  return 0;
}

function isAllTestsPassed(evalJson: unknown): boolean {
  if (!evalJson || typeof evalJson !== 'object') return false;
  const summary = (evalJson as Record<string, unknown>).test_summary;
  if (!summary || typeof summary !== 'object') return false;

  const allPassed = (summary as Record<string, unknown>).all_passed;
  if (allPassed === true) return true;

  const total = Number((summary as Record<string, unknown>).total ?? 0);
  const passed = Number((summary as Record<string, unknown>).passed ?? 0);
  return Number.isFinite(total) && Number.isFinite(passed) && total > 0 && passed === total;
}

export async function POST(req: Request) {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  let clerkId: string | null = null;
  if (!isAuthDisabled) {
    try {
      const authData = await auth();
      clerkId = authData.userId ?? null;
    } catch { /* noop */ }
  } else {
    clerkId = 'local';
  }

  if (!clerkId) {
    return Response.json({ detail: 'unauthenticated' }, { status: 401 });
  }

  let body: SubmitRequest;
  try {
    body = await req.json() as SubmitRequest;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const challengeDescription = String(body.challenge_description ?? '').trim();
  const studentCode = String(body.student_code ?? '').trim();
  const difficulty = Math.max(1, Math.min(10, Number(body.difficulty ?? 1) || 1));

  if (!challengeDescription || !studentCode) {
    return Response.json({ detail: 'Нужны поля challenge_description и student_code.' }, { status: 400 });
  }

  // ── 1. Validation réelle via exécution des tests backend ─────────────
  let evaluationJson: Record<string, unknown> | null = null;
  let evaluationText = '';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_PY_RUNTIME_URL
    || 'http://127.0.0.1:8002';

  try {
    const evaluationRes = await fetch(`${apiBaseUrl}/submit-challenge/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_description: challengeDescription,
        challenge_tests: body.challenge_tests ?? {},
        student_code: studentCode,
      }),
    });

    if (!evaluationRes.ok) {
      const detail = await evaluationRes.text();
      return Response.json({ detail: `execution_failed: ${detail}` }, { status: 502 });
    }

    const payload = await evaluationRes.json() as {
      evaluation?: string;
      evaluation_json?: unknown;
    };

    evaluationText = String(payload.evaluation ?? '');
    if (payload.evaluation_json && typeof payload.evaluation_json === 'object') {
      evaluationJson = payload.evaluation_json as Record<string, unknown>;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'execution_error';
    return Response.json({ detail }, { status: 502 });
  }

  const score = extractScore(evaluationJson, evaluationText);
  const passed = isAllTestsPassed(evaluationJson);

  // ── 2. Calcul des points gagnés/perdus ────────────────────────────────
  // Succès : difficulty * 15 pts | Échec : -difficulty * 5 pts (min 0 global)
  const pointsDelta = passed
    ? difficulty * 15
    : -(difficulty * 5);

  // ── 3. Récupère ou crée la session de l'user ──────────────────────────
  try {
    const session = await withPrismaRetry(() => prisma.exerciseSession.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, level: 'debutant', difficulty: 1 },
    }));

  // ── 4. Mise à jour de la progression ──────────────────────────────────
  const newTotalPoints = Math.max(0, session.totalPoints + pointsDelta);
  const newPassedCount = session.passedCount + (passed ? 1 : 0);
  const newFailedCount = session.failedCount + (passed ? 0 : 1);
  const newConsecutiveWins = passed ? session.consecutiveWins + 1 : Math.max(0, session.consecutiveWins - 1);

  // Difficulté : +1 chaque 2 victoires consécutives, -1 à chaque échec
  let newDifficulty = session.difficulty;
  if (passed && newConsecutiveWins > 0 && newConsecutiveWins % 2 === 0) {
    newDifficulty = Math.min(10, session.difficulty + 1);
  } else if (!passed) {
    newDifficulty = Math.max(1, session.difficulty - 1);
  }

  const newLevel = computeLevel(newTotalPoints, newPassedCount);

    const updatedSession = await withPrismaRetry(() => prisma.exerciseSession.update({
      where: { clerkId },
      data: {
        level: newLevel,
        difficulty: newDifficulty,
        totalPoints: newTotalPoints,
        passedCount: newPassedCount,
        failedCount: newFailedCount,
        consecutiveWins: newConsecutiveWins,
      },
    }));

  // ── 5. Sauvegarde l'attempt ───────────────────────────────────────────
  const challengeTitle = typeof body.challenge_json?.enonce === 'string'
    ? body.challenge_json.enonce.slice(0, 80)
    : challengeDescription.slice(0, 80);

    await withPrismaRetry(() => prisma.exerciseAttempt.create({
      data: {
        clerkId,
        sessionId: session.id,
        challengeTitle,
        challengeJson: (body.challenge_json ?? { description: challengeDescription }) as object,
        submittedCode: studentCode,
        score,
        passed,
        pointsEarned: passed ? difficulty * 15 : pointsDelta,
        difficulty,
        evaluation: evaluationJson as object ?? undefined,
      },
    }));

  // ── 6. Info niveau suivant ───────────────────────────────────────────
    const isMaxLevel = newLevel === 'avance';
    const nextThresholdKey = newLevel === 'debutant' ? 'debutant' : 'intermediaire';

    return Response.json({
      score,
      passed,
      evaluation: evaluationText,
      evaluationJson,
      pointsDelta,
      pointsEarned: passed ? difficulty * 15 : pointsDelta,
      stats: {
        level: newLevel,
        difficulty: updatedSession.difficulty,
        totalPoints: updatedSession.totalPoints,
        passedCount: updatedSession.passedCount,
        failedCount: updatedSession.failedCount,
        consecutiveWins: updatedSession.consecutiveWins,
        nextLevelPoints: isMaxLevel ? null : THRESHOLDS[nextThresholdKey].points,
        nextLevelPassed: isMaxLevel ? null : THRESHOLDS[nextThresholdKey].passed,
      },
      levelUp: newLevel !== session.level,
      difficultyChange: newDifficulty - session.difficulty,
    });
  } catch (err) {
    if (isTransientPrismaError(err)) {
      return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
    }
    throw err;
  }
}
