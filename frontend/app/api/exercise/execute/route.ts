import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExecuteRequest = {
  challenge_description?: string;
  challenge_tests?: Record<string, unknown> | null;
  student_code?: string;
};

function clampScore(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function extractScoreFromEvaluation(evalJson: unknown, fallback: string): number {
  if (evalJson && typeof evalJson === 'object') {
    const raw = (evalJson as Record<string, unknown>).note;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return clampScore((raw / 10) * 100);
    }
    if (typeof raw === 'string') {
      const parsed = Number(raw.replace(',', '.').replace('/10', ''));
      if (Number.isFinite(parsed)) {
        return clampScore((parsed / 10) * 100);
      }
    }

    const summary = (evalJson as Record<string, unknown>).test_summary;
    if (summary && typeof summary === 'object') {
      const total = Number((summary as Record<string, unknown>).total ?? 0);
      const passed = Number((summary as Record<string, unknown>).passed ?? 0);
      if (Number.isFinite(total) && total > 0 && Number.isFinite(passed)) {
        return clampScore((passed / total) * 100);
      }
    }
  }

  const m = fallback.match(/note\s*[:=]\s*(\d+(?:[\.,]\d+)?)/i);
  if (m?.[1]) {
    const parsed = Number(m[1].replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return clampScore((parsed / 10) * 100);
    }
  }
  return 0;
}

export async function POST(req: Request) {
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

  let body: ExecuteRequest;
  try {
    body = await req.json() as ExecuteRequest;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const challengeDescription = String(body.challenge_description ?? '').trim();
  const studentCode = String(body.student_code ?? '').trim();
  if (!challengeDescription || !studentCode) {
    return Response.json({ detail: 'Нужны поля challenge_description и student_code.' }, { status: 400 });
  }

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

    const evaluation = String(payload.evaluation ?? '');
    const evaluationJson = (payload.evaluation_json && typeof payload.evaluation_json === 'object')
      ? payload.evaluation_json as Record<string, unknown>
      : null;

    const score = extractScoreFromEvaluation(evaluationJson, evaluation);
    const allPassed = Boolean(
      evaluationJson
      && typeof evaluationJson === 'object'
      && (evaluationJson as Record<string, unknown>).test_summary
      && typeof (evaluationJson as Record<string, unknown>).test_summary === 'object'
      && ((evaluationJson as Record<string, unknown>).test_summary as Record<string, unknown>).all_passed === true,
    );

    return Response.json({
      score,
      passed: allPassed || score >= 60,
      evaluation,
      evaluationJson,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'execution_error';
    return Response.json({ detail }, { status: 502 });
  }
}
