import { auth } from '@clerk/nextjs/server';
import { getExerciseSupabaseClient } from '../_lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DRAFT_MARKER = '# EXERCISE_CHALLENGE_DRAFT';

function difficultyToLabel(d: number): 'debutant' | 'intermediaire' | 'avance' {
  if (d <= 3) return 'debutant';
  if (d <= 6) return 'intermediaire';
  return 'avance';
}

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
    const supabase = getExerciseSupabaseClient();

    const latestDraftQuery = await supabase
      .from('ExerciseAttempt')
      .select('*')
      .eq('clerkId', clerkId)
      .like('submittedCode', `${DRAFT_MARKER}%`)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDraftQuery.error) {
      return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
    }

    const latestDraft = latestDraftQuery.data;
    if (!latestDraft) {
      return Response.json({ detail: 'not_found' }, { status: 404 });
    }

    const evaluation = latestDraft.evaluation && typeof latestDraft.evaluation === 'object'
      ? latestDraft.evaluation as Record<string, unknown>
      : {};

    const challenge = String(evaluation.challenge ?? latestDraft.challengeTitle ?? '').trim();
    const challengeTests = (evaluation.challenge_tests && typeof evaluation.challenge_tests === 'object')
      ? evaluation.challenge_tests as Record<string, unknown>
      : {
          mode: 'function',
          function_name: 'solution',
          test_cases: [],
          quality_checks: [],
        };

    const submittedCode = String(latestDraft.submittedCode ?? '');
    const starterCode = submittedCode.startsWith(`${DRAFT_MARKER}\n`)
      ? submittedCode.slice(`${DRAFT_MARKER}\n`.length)
      : submittedCode;

    const challengeJson = latestDraft.challengeJson && typeof latestDraft.challengeJson === 'object'
      ? latestDraft.challengeJson as Record<string, unknown>
      : {};

    const difficulty = Number(latestDraft.difficulty ?? 1) || 1;

    return Response.json({
      challenge: challenge || String(challengeJson.enonce ?? '').trim() || `Задача уровня ${difficulty}`,
      challenge_json: {
        enonce: String(challengeJson.enonce ?? challenge).trim(),
        contraintes: Array.isArray(challengeJson.contraintes)
          ? (challengeJson.contraintes as unknown[]).map(String).filter(Boolean)
          : [],
        concepts: Array.isArray(challengeJson.concepts)
          ? (challengeJson.concepts as unknown[]).map(String).filter(Boolean)
          : [],
        hints: Array.isArray(challengeJson.hints)
          ? (challengeJson.hints as unknown[]).map(String).filter(Boolean)
          : [],
        exemple: String(challengeJson.exemple ?? '').trim(),
        starter_code: starterCode,
      },
      starter_code: starterCode,
      challenge_tests: {
        mode: 'function',
        function_name: String(challengeTests.function_name ?? 'solution').trim() || 'solution',
        test_cases: Array.isArray(challengeTests.test_cases)
          ? (challengeTests.test_cases as Record<string, unknown>[]).map((t, i) => ({
              name: String(t.name ?? `test_${i + 1}`).trim(),
              args_literal: String(t.args_literal ?? '[]').trim(),
              expected_literal: String(t.expected_literal ?? 'None').trim(),
            }))
          : [],
        quality_checks: Array.isArray(challengeTests.quality_checks)
          ? (challengeTests.quality_checks as unknown[]).map(String).filter(Boolean)
          : [],
      },
      difficulty,
      level: difficultyToLabel(difficulty),
    });
  } catch (err) {
    console.error('[exercise/latest] error:', err);
    return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
  }
}
