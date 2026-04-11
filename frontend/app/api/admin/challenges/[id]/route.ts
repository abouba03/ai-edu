import prisma from '@/lib/prisma';
import { getAdminContext } from '@/lib/admin-auth';

type AdminChallengePayload = {
  title?: string;
  description?: string;
  difficulty?: string;
  points?: number;
  kind?: 'code' | 'theory';
  theoryFormat?: 'qcm' | 'true_false' | 'free_text' | 'mixed';
  theoryQuestionCount?: number;
  estimatedMinutes?: number;
  language?: string;
  formationId?: string;
  formationName?: string;
  tags?: string[];
  starterCode?: string;
  hints?: string[];
  testCases?: Array<{ label?: string; input?: string; expected?: string }>;
  quizQuestions?: Array<{
    question?: string;
    choices?: string[];
    answer?: string;
    explanation?: string;
  }>;
  generatedPrompt?: string;
  generationSource?: 'generate-challenge' | 'generate-quiz';
  isPublished?: boolean;
};

type ChallengeMeta = {
  version: 'admin-challenge-v1';
  kind: 'code' | 'theory';
  theoryFormat: 'qcm' | 'true_false' | 'free_text' | 'mixed' | null;
  theoryQuestionCount: number;
  estimatedMinutes: number;
  language: string;
  formationId: string | null;
  formationName: string;
  tags: string[];
  starterCode: string;
  hints: string[];
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: Array<{
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  }>;
  generatedPrompt: string;
  generationSource: 'generate-challenge' | 'generate-quiz' | null;
  isPublished: boolean;
};

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeHints(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeTestCases(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ label: string; input: string; expected: string }>;
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { label?: unknown; input?: unknown; expected?: unknown };
      const label = cleanText(row.label, `Cas ${index + 1}`);
      const input = cleanText(row.input);
      const expected = cleanText(row.expected);
      if (!input && !expected) return null;
      return { label, input, expected };
    })
    .filter((row): row is { label: string; input: string; expected: string } => Boolean(row))
    .slice(0, 20);
}

function normalizeQuizQuestions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ question: string; choices: string[]; answer: string; explanation: string }>;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const question = cleanText(row.question);
      if (!question) return null;
      const choices = Array.isArray(row.choices)
        ? row.choices.map((choice) => cleanText(choice)).filter(Boolean).slice(0, 6)
        : [];
      return {
        question,
        choices,
        answer: cleanText(row.answer),
        explanation: cleanText(row.explanation),
      };
    })
    .filter((row): row is { question: string; choices: string[]; answer: string; explanation: string } => Boolean(row))
    .slice(0, 20);
}

function normalizeKind(value: unknown): 'code' | 'theory' {
  return value === 'theory' ? 'theory' : 'code';
}

function normalizeTheoryFormat(value: unknown): 'qcm' | 'true_false' | 'free_text' | 'mixed' | null {
  if (value === 'qcm' || value === 'true_false' || value === 'free_text' || value === 'mixed') return value;
  return null;
}

function readMeta(value: unknown): ChallengeMeta {
  if (!value || typeof value !== 'object') {
    return {
      version: 'admin-challenge-v1',
      kind: 'code',
      theoryFormat: null,
      theoryQuestionCount: 6,
      estimatedMinutes: 20,
      language: 'Python',
      formationId: null,
      formationName: 'Formation générale',
      tags: [],
      starterCode: '',
      hints: [],
      testCases: [],
      quizQuestions: [],
      generatedPrompt: '',
      generationSource: null,
      isPublished: false,
    };
  }

  const raw = value as Record<string, unknown>;
  const kind = normalizeKind(raw.kind);
  return {
    version: 'admin-challenge-v1',
    kind,
    theoryFormat: kind === 'theory' ? normalizeTheoryFormat(raw.theoryFormat) ?? 'mixed' : null,
    theoryQuestionCount: Math.max(3, Math.min(20, Number(raw.theoryQuestionCount ?? 6) || 6)),
    estimatedMinutes: Math.max(5, Math.min(240, Number(raw.estimatedMinutes ?? 20) || 20)),
    language: cleanText(raw.language, 'Python') || 'Python',
    formationId: cleanText(raw.formationId) || null,
    formationName: cleanText(raw.formationName, 'Formation générale') || 'Formation générale',
    tags: normalizeTags(raw.tags),
    starterCode: cleanText(raw.starterCode),
    hints: normalizeHints(raw.hints),
    testCases: normalizeTestCases(raw.testCases),
    quizQuestions: normalizeQuizQuestions(raw.quizQuestions),
    generatedPrompt: cleanText(raw.generatedPrompt),
    generationSource: raw.generationSource === 'generate-quiz'
      ? 'generate-quiz'
      : raw.generationSource === 'generate-challenge'
        ? 'generate-challenge'
        : null,
    isPublished: Boolean(raw.isPublished),
  };
}

function normalizeForUpdate(payload: AdminChallengePayload, previousMeta: ChallengeMeta) {
  const data: {
    title?: string;
    description?: string | null;
    difficulty?: string;
    points?: number;
    formationId?: string | null;
    testCases?: ChallengeMeta;
  } = {};

  if (typeof payload.title === 'string') {
    const title = payload.title.trim();
    if (!title) return { ok: false as const, error: 'title_empty' };
    data.title = title;
  }

  if (typeof payload.description === 'string') {
    data.description = payload.description.trim() || null;
  }

  if (typeof payload.difficulty === 'string') {
    const difficulty = payload.difficulty.trim();
    if (!difficulty) return { ok: false as const, error: 'difficulty_empty' };
    data.difficulty = difficulty;
  }

  if (payload.points !== undefined) {
    data.points = Math.max(0, Math.min(1000, Number(payload.points) || 0));
  }

  if (payload.formationId !== undefined) {
    data.formationId = cleanText(payload.formationId) || null;
  }

  const shouldUpdateMeta =
    payload.kind !== undefined ||
    payload.theoryFormat !== undefined ||
    payload.theoryQuestionCount !== undefined ||
    payload.estimatedMinutes !== undefined ||
    payload.language !== undefined ||
    payload.formationId !== undefined ||
    payload.formationName !== undefined ||
    payload.tags !== undefined ||
    payload.starterCode !== undefined ||
    payload.hints !== undefined ||
    payload.testCases !== undefined ||
    payload.quizQuestions !== undefined ||
    payload.generatedPrompt !== undefined ||
    payload.generationSource !== undefined ||
    payload.isPublished !== undefined;

  if (shouldUpdateMeta) {
    const kind = payload.kind !== undefined ? normalizeKind(payload.kind) : previousMeta.kind;
    data.testCases = {
      version: 'admin-challenge-v1',
      kind,
      theoryFormat:
        kind === 'theory'
          ? payload.theoryFormat !== undefined
            ? normalizeTheoryFormat(payload.theoryFormat) ?? 'mixed'
            : previousMeta.theoryFormat ?? 'mixed'
          : null,
      theoryQuestionCount:
        payload.theoryQuestionCount !== undefined
          ? Math.max(3, Math.min(20, Number(payload.theoryQuestionCount) || 6))
          : previousMeta.theoryQuestionCount,
      estimatedMinutes:
        payload.estimatedMinutes !== undefined
          ? Math.max(5, Math.min(240, Number(payload.estimatedMinutes) || 20))
          : previousMeta.estimatedMinutes,
      language: payload.language !== undefined ? cleanText(payload.language, 'Python') || 'Python' : previousMeta.language,
      formationId: payload.formationId !== undefined ? cleanText(payload.formationId) || null : previousMeta.formationId,
      formationName:
        payload.formationName !== undefined
          ? cleanText(payload.formationName, 'Formation générale') || 'Formation générale'
          : previousMeta.formationName,
      tags: payload.tags !== undefined ? normalizeTags(payload.tags) : previousMeta.tags,
      starterCode: payload.starterCode !== undefined ? cleanText(payload.starterCode) : previousMeta.starterCode,
      hints: payload.hints !== undefined ? normalizeHints(payload.hints) : previousMeta.hints,
      testCases: payload.testCases !== undefined ? normalizeTestCases(payload.testCases) : previousMeta.testCases,
      quizQuestions: payload.quizQuestions !== undefined ? normalizeQuizQuestions(payload.quizQuestions) : previousMeta.quizQuestions,
      generatedPrompt: payload.generatedPrompt !== undefined ? cleanText(payload.generatedPrompt) : previousMeta.generatedPrompt,
      generationSource:
        payload.generationSource !== undefined
          ? payload.generationSource === 'generate-quiz'
            ? 'generate-quiz'
            : payload.generationSource === 'generate-challenge'
              ? 'generate-challenge'
              : null
          : previousMeta.generationSource,
      isPublished: payload.isPublished !== undefined ? Boolean(payload.isPublished) : previousMeta.isPublished,
    };
  }

  return { ok: true as const, data };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  let payload: AdminChallengePayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const current = await prisma.challenge.findUnique({
      where: { id },
      select: { testCases: true },
    });

    if (!current) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const normalized = normalizeForUpdate(payload, readMeta(current.testCases));
    if (!normalized.ok) {
      return Response.json({ ok: false, error: normalized.error }, { status: 400 });
    }

    if (Object.keys(normalized.data).length === 0) {
      return Response.json({ ok: false, error: 'empty_update' }, { status: 400 });
    }

    if (normalized.data.formationId) {
      const formation = await prisma.formation.findUnique({
        where: { id: normalized.data.formationId },
        select: { id: true },
      });

      if (!formation) {
        return Response.json({ ok: false, error: 'formation_not_found' }, { status: 400 });
      }
    }

    const challenge = await prisma.challenge.update({
      where: { id },
      data: normalized.data,
    });

    return Response.json({ ok: true, challenge });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  try {
    await prisma.challenge.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}