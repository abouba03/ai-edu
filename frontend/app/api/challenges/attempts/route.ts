import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';

type AttemptPayload = {
  challengeId?: string;
  kind?: 'code' | 'theory';
  studentCode?: string;
  answers?: string[];
  durationSec?: number;
};

type MotivationalRequest = {
  username: string;
  recent_result: string;
  mood: 'heureux' | 'neutre' | 'frustré' | 'douteux';
};

type TheoryQuestionMeta = { question: string; answer: string; explanation: string };

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractScoreFromEvaluation(evaluationJson: unknown, fallbackText: string) {
  if (evaluationJson && typeof evaluationJson === 'object') {
    const noteRaw = (evaluationJson as Record<string, unknown>).note;
    if (typeof noteRaw === 'number' && Number.isFinite(noteRaw)) {
      return clampScore((noteRaw / 10) * 100);
    }
    if (typeof noteRaw === 'string') {
      const parsed = Number(noteRaw.replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return clampScore((parsed / 10) * 100);
      }
    }
  }

  const byRegex = fallbackText.match(/note\s*[:=]\s*(\d+(?:[\.,]\d+)?)/i);
  if (byRegex?.[1]) {
    const parsed = Number(byRegex[1].replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return clampScore((parsed / 10) * 100);
    }
  }

  return 0;
}

async function resolveActor() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  if (isAuthDisabled) {
    return { clerkId: 'local', userId: null, username: 'Étudiant local' };
  }

  try {
    const authData = await auth();
    if (authData.userId) {
      try {
        const user = await prisma.user.findUnique({ where: { clerkId: authData.userId } });
        const guessedName = (user?.displayName || user?.email || '').trim();
        return {
          clerkId: authData.userId,
          userId: user?.id ?? null,
          username: guessedName || 'Étudiant',
        };
      } catch {
        return { clerkId: authData.userId, userId: null, username: 'Étudiant' };
      }
    }
  } catch {
    // noop
  }

  return { clerkId: null, userId: null, username: 'Étudiant' };
}

function buildMoodFromScore(score: number, passed: boolean): MotivationalRequest['mood'] {
  if (passed) return 'heureux';
  if (score <= 40) return 'frustré';
  if (score <= 65) return 'douteux';
  return 'neutre';
}

function mergeEvaluationWithMotivation(evaluationJson: unknown, motivationalMessage: string | null, fallbackText?: string) {
  if (evaluationJson && typeof evaluationJson === 'object' && !Array.isArray(evaluationJson)) {
    const base = evaluationJson as Record<string, unknown>;
    return {
      ...base,
      ...(fallbackText ? { summary: String(base.summary || fallbackText) } : {}),
      ...(motivationalMessage ? { motivational_message: motivationalMessage } : {}),
    } as Prisma.InputJsonValue;
  }

  return {
    ...(fallbackText ? { summary: fallbackText } : {}),
    ...(motivationalMessage ? { motivational_message: motivationalMessage } : {}),
  } as Prisma.InputJsonValue;
}

function compactText(value: string | null | undefined, limit = 220) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function extractChallengeTheme(title: string, description: string | null | undefined) {
  const desc = compactText(description, 180);
  return desc || compactText(title, 120) || 'thème non précisé';
}

function buildTheoryRecentResult(args: {
  challengeTitle: string;
  challengeDescription?: string | null;
  level: string;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  durationSec?: number | null;
  questions: TheoryQuestionMeta[];
  answers: string[];
}) {
  const {
    challengeTitle,
    challengeDescription,
    level,
    score,
    passed,
    correct,
    total,
    durationSec,
    questions,
    answers,
  } = args;

  const wrongEntries: string[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    const expected = questions[i].answer.trim().toLowerCase();
    const actual = (answers[i] || '').trim().toLowerCase();
    if (!expected || actual === expected) continue;

    const questionLabel = compactText(questions[i].question, 110);
    const expectedLabel = compactText(questions[i].answer, 30) || 'réponse attendue';
    const actualLabel = compactText(answers[i], 30) || 'vide';
    wrongEntries.push(`Q: ${questionLabel} | attendu: ${expectedLabel} | sa réponse: ${actualLabel}`);
    if (wrongEntries.length >= 3) break;
  }

  const weakSignal = wrongEntries.length > 0
    ? `Points à renforcer (${wrongEntries.length}): ${wrongEntries.join(' || ')}`
    : 'Aucune erreur conceptuelle détectée.';

  return [
    `Challenge théorie: ${challengeTitle}`,
    `Thème: ${extractChallengeTheme(challengeTitle, challengeDescription)}`,
    `Niveau: ${level} | Score: ${score}/100 | Résultat: ${correct}/${total} | Statut: ${passed ? 'validé' : 'non validé'}`,
    durationSec ? `Temps: ${durationSec}s` : null,
    weakSignal,
    'Objectif du message: encourager sur la progression réelle et orienter la prochaine révision.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function buildCodeRecentResult(args: {
  challengeTitle: string;
  challengeDescription?: string | null;
  level: string;
  score: number;
  passed: boolean;
  durationSec?: number | null;
  evaluationText: string;
  evaluationJson: unknown;
}) {
  const {
    challengeTitle,
    challengeDescription,
    level,
    score,
    passed,
    durationSec,
    evaluationText,
    evaluationJson,
  } = args;

  let testsSignal = 'Détails tests indisponibles.';
  let runtimeSignal = '';
  const failedTests: string[] = [];

  if (evaluationJson && typeof evaluationJson === 'object' && !Array.isArray(evaluationJson)) {
    const row = evaluationJson as Record<string, unknown>;
    if (row.test_summary && typeof row.test_summary === 'object') {
      const summary = row.test_summary as Record<string, unknown>;
      const passedTests = Number(summary.passed ?? 0);
      const totalTests = Number(summary.total ?? 0);
      const allPassed = Boolean(summary.all_passed);
      testsSignal = allPassed
        ? `${passedTests}/${totalTests} tests validés (tous passés).`
        : `${passedTests}/${totalTests} tests validés.`;

      const runtimeError = compactText(String(summary.runtime_error || ''), 160);
      if (runtimeError) runtimeSignal = `Erreur runtime: ${runtimeError}`;
    }

    if (Array.isArray(row.test_results)) {
      const rows = row.test_results as Array<Record<string, unknown>>;
      for (const item of rows) {
        const status = String(item.status || '').toLowerCase();
        if (status !== 'failed') continue;
        const name = compactText(String(item.name || 'test'), 60);
        const error = compactText(String(item.error || item.actual || ''), 90);
        failedTests.push(error ? `${name}: ${error}` : name);
        if (failedTests.length >= 3) break;
      }
    }
  }

  const fallbackSnippet = compactText(evaluationText, 170);

  return [
    `Challenge code: ${challengeTitle}`,
    `Thème: ${extractChallengeTheme(challengeTitle, challengeDescription)}`,
    `Niveau: ${level} | Score: ${score}/100 | Statut: ${passed ? 'validé' : 'non validé'}`,
    durationSec ? `Temps: ${durationSec}s` : null,
    testsSignal,
    failedTests.length > 0 ? `Tests échoués clés: ${failedTests.join(' || ')}` : null,
    runtimeSignal || null,
    fallbackSnippet ? `Synthèse évaluation: ${fallbackSnippet}` : null,
    'Objectif du message: reconnaître les progrès et proposer une direction concrète de correction.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

async function fetchMotivationalMessage(apiBaseUrl: string, payload: MotivationalRequest) {
  try {
    const res = await fetch(`${apiBaseUrl}/motivational-feedback/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { message?: unknown };
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    return message || null;
  } catch {
    return null;
  }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseMeta(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      kind: 'code' as const,
      quizQuestions: [] as Array<{ question: string; answer: string; explanation: string }> ,
    };
  }
  const raw = value as Record<string, unknown>;
  const quizQuestions = Array.isArray(raw.quizQuestions)
    ? raw.quizQuestions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const question = asText(row.question);
          if (!question) return null;
          return {
            question,
            answer: asText(row.answer),
            explanation: asText(row.explanation),
          };
        })
        .filter((row): row is { question: string; answer: string; explanation: string } => Boolean(row))
    : [];

  return {
    kind: raw.kind === 'theory' ? 'theory' as const : 'code' as const,
    quizQuestions,
  };
}

export async function POST(req: Request) {
  let payload: AttemptPayload;
  try {
    payload = (await req.json()) as AttemptPayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const challengeId = asText(payload.challengeId);
  if (!challengeId) {
    return Response.json({ ok: false, error: 'missing_challenge_id' }, { status: 400 });
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      title: true,
      description: true,
      difficulty: true,
      testCases: true,
    },
  });

  if (!challenge) {
    return Response.json({ ok: false, error: 'challenge_not_found' }, { status: 404 });
  }

  const meta = parseMeta(challenge.testCases);
  const kind = payload.kind === 'theory' || meta.kind === 'theory' ? 'theory' : 'code';
  const actor = await resolveActor();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  if (kind === 'theory') {
    const answers = Array.isArray(payload.answers) ? payload.answers.map((item) => String(item ?? '')) : [];
    const total = meta.quizQuestions.length;
    const correct = meta.quizQuestions.reduce((sum, question, index) => {
      const expected = question.answer.trim().toLowerCase();
      const actual = (answers[index] || '').trim().toLowerCase();
      return sum + (expected && actual === expected ? 1 : 0);
    }, 0);

    const score = total > 0 ? clampScore((correct / total) * 100) : 0;
    const passed = score >= 70;
    const evaluation = `Résultat: ${correct}/${total} bonnes réponses.`;
    const recentResult = buildTheoryRecentResult({
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      level: challenge.difficulty,
      score,
      passed,
      correct,
      total,
      durationSec: payload.durationSec ?? null,
      questions: meta.quizQuestions,
      answers,
    });

    const motivationalMessage = await fetchMotivationalMessage(apiBaseUrl, {
      username: actor.username,
      recent_result: recentResult,
      mood: buildMoodFromScore(score, passed),
    });

    const persisted = await prisma.challengeAttempt.create({
      data: {
        userId: actor.userId,
        clerkId: actor.clerkId,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        challengeKind: 'theory',
        level: challenge.difficulty,
        submittedCode: JSON.stringify({ answers }),
        durationSec: payload.durationSec ? Math.max(1, payload.durationSec) : null,
        score,
        passed,
        evaluation: {
          summary: evaluation,
          score,
          correct,
          total,
          ...(motivationalMessage ? { motivational_message: motivationalMessage } : {}),
        } as Prisma.InputJsonValue,
        challengeContext: {
          title: challenge.title,
          kind: 'theory',
        },
      },
    });

    return Response.json({
      ok: true,
      score,
      passed,
      evaluation,
      motivationalMessage,
      attemptId: persisted.id,
    });
  }

  const studentCode = asText(payload.studentCode);
  if (!studentCode) {
    return Response.json({ ok: false, error: 'missing_student_code' }, { status: 400 });
  }

  try {
    const evaluationRes = await fetch(`${apiBaseUrl}/submit-challenge/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_description: `${challenge.title}\n${challenge.description || ''}`.trim(),
        student_code: studentCode,
        pedagogy_context: {
          level: challenge.difficulty,
          pedagogicalStyle: 'Feedback explicatif + actionnable',
          aiTone: 'Évaluateur pédagogique précis',
        },
      }),
    });

    if (!evaluationRes.ok) {
      const detail = await evaluationRes.text();
      return Response.json({ ok: false, error: 'evaluation_failed', detail }, { status: 502 });
    }

    const evaluationData = (await evaluationRes.json()) as {
      evaluation?: string;
      evaluation_json?: unknown;
    };

    const evaluationText = String(evaluationData.evaluation ?? '');
    const score = extractScoreFromEvaluation(evaluationData.evaluation_json, evaluationText);
    const passed = score >= 70;
    const recentResult = buildCodeRecentResult({
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      level: challenge.difficulty,
      score,
      passed,
      durationSec: payload.durationSec ?? null,
      evaluationText,
      evaluationJson: evaluationData.evaluation_json,
    });

    const motivationalMessage = await fetchMotivationalMessage(apiBaseUrl, {
      username: actor.username,
      recent_result: recentResult,
      mood: buildMoodFromScore(score, passed),
    });

    const mergedEvaluationJson = mergeEvaluationWithMotivation(
      evaluationData.evaluation_json,
      motivationalMessage,
      evaluationText,
    );

    const persisted = await prisma.challengeAttempt.create({
      data: {
        userId: actor.userId,
        clerkId: actor.clerkId,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        challengeKind: 'code',
        level: challenge.difficulty,
        submittedCode: studentCode,
        durationSec: payload.durationSec ? Math.max(1, payload.durationSec) : null,
        score,
        passed,
        evaluation: mergedEvaluationJson,
        challengeContext: {
          title: challenge.title,
          kind: 'code',
        },
      },
    });

    return Response.json({
      ok: true,
      score,
      passed,
      evaluation: evaluationText,
      evaluationJson: mergedEvaluationJson,
      motivationalMessage,
      attemptId: persisted.id,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'server_error';
    return Response.json({ ok: false, error: 'server_error', detail }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const actor = await resolveActor();
  if (!actor.clerkId) {
    return Response.json({ ok: true, attempts: [] });
  }

  const { searchParams } = new URL(req.url);
  const challengeId = asText(searchParams.get('challengeId'));

  try {
    const attempts = await prisma.challengeAttempt.findMany({
      where: {
        clerkId: actor.clerkId,
        ...(challengeId ? { challengeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        challengeId: true,
        challengeTitle: true,
        challengeKind: true,
        level: true,
        durationSec: true,
        score: true,
        passed: true,
        evaluation: true,
        createdAt: true,
      },
    });

    return Response.json({ ok: true, attempts });
  } catch {
    return Response.json({ ok: true, attempts: [] });
  }
}
