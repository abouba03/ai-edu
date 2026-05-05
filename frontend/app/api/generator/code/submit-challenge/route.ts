import { callOpenAI, parseJsonFromText } from '@/lib/generator-ai/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubmitRequest = {
  challenge_description?: string;
  student_code?: string;
  challenge_tests?: Record<string, unknown> | null;
  pedagogy_context?: Record<string, unknown>;
};

type EvaluationJson = {
  note?: string;
  commentaire?: string;
  test_summary?: {
    passed: number;
    failed: number;
    total: number;
    all_passed: boolean;
    runtime_error?: string | null;
  };
  test_results?: Array<{
    name?: string;
    status?: 'passed' | 'failed';
    expected?: string;
    actual?: string;
    error?: string;
    constraint?: string;
  }>;
};

export async function POST(req: Request) {
  let body: SubmitRequest;
  try {
    body = (await req.json()) as SubmitRequest;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const challengeDescription = String(body.challenge_description || '').trim();
  const studentCode = String(body.student_code || '').trim();
  const responseLanguage = String(body.pedagogy_context?.responseLanguage || 'francais simple');

  if (!challengeDescription || !studentCode) {
    return Response.json({ detail: 'challenge_description et student_code sont requis.' }, { status: 400 });
  }

  const testsRaw = JSON.stringify(body.challenge_tests || {}, null, 2);

  const system = [
    `Tu es un evaluateur de code Python. Reponds en ${responseLanguage}.`,
    'Retourne uniquement un JSON valide avec les cles: evaluation_json.',
    'evaluation_json doit contenir note, commentaire, test_summary, test_results.',
    'N invente pas des executions reelles: appuie-toi sur le code et les tests fournis.',
  ].join('\n');

  const user = [
    'Enonce:',
    challengeDescription,
    '',
    'Code etudiant:',
    '```python',
    studentCode,
    '```',
    '',
    'Tests proposes:',
    testsRaw,
    '',
    'Retour attendu:',
    '{"evaluation_json":{"note":"x/10","commentaire":"...","test_summary":{"passed":0,"failed":0,"total":0,"all_passed":false},"test_results":[{"name":"...","status":"passed|failed","expected":"...","actual":"...","error":"..."}]}}',
  ].join('\n');

  try {
    const raw = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      maxTokens: 1800,
    });

    const parsed = parseJsonFromText<{ evaluation_json?: EvaluationJson }>(raw);
    const evaluationJson = parsed?.evaluation_json ?? {
      note: '0/10',
      commentaire: 'Evaluation indisponible. Reessaie.',
      test_summary: { passed: 0, failed: 1, total: 1, all_passed: false, runtime_error: 'evaluation_unavailable' },
      test_results: [{ name: 'evaluation', status: 'failed', error: 'evaluation_unavailable' }],
    };

    return Response.json({
      evaluation: JSON.stringify(evaluationJson),
      evaluation_json: evaluationJson,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'OpenAI indisponible';
    return Response.json({ detail }, { status: 502 });
  }
}
