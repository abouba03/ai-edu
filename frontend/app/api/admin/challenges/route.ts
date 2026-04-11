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

function normalizeCreatePayload(payload: AdminChallengePayload) {
  const title = cleanText(payload.title);
  const difficulty = cleanText(payload.difficulty, 'intermédiaire');

  if (!title) {
    return { ok: false as const, error: 'title_required' };
  }

  const points = Math.max(0, Math.min(1000, Number(payload.points ?? 50) || 0));
  const estimatedMinutes = Math.max(5, Math.min(240, Number(payload.estimatedMinutes ?? 20) || 20));
  const theoryQuestionCount = Math.max(3, Math.min(20, Number(payload.theoryQuestionCount ?? 6) || 6));
  const kind = normalizeKind(payload.kind);
  const theoryFormat = kind === 'theory' ? normalizeTheoryFormat(payload.theoryFormat) ?? 'mixed' : null;
  const generationSource = payload.generationSource === 'generate-quiz'
    ? 'generate-quiz'
    : payload.generationSource === 'generate-challenge'
      ? 'generate-challenge'
      : null;

  const meta: ChallengeMeta = {
    version: 'admin-challenge-v1',
    kind,
    theoryFormat,
    theoryQuestionCount,
    estimatedMinutes,
    language: cleanText(payload.language, 'Python') || 'Python',
    formationId: cleanText(payload.formationId) || null,
    formationName: cleanText(payload.formationName, 'Formation générale') || 'Formation générale',
    tags: normalizeTags(payload.tags),
    starterCode: cleanText(payload.starterCode),
    hints: normalizeHints(payload.hints),
    testCases: normalizeTestCases(payload.testCases),
    quizQuestions: normalizeQuizQuestions(payload.quizQuestions),
    generatedPrompt: cleanText(payload.generatedPrompt),
    generationSource,
    isPublished: Boolean(payload.isPublished),
  };

  return {
    ok: true as const,
    data: {
      title,
      description: cleanText(payload.description) || null,
      difficulty,
      points,
      formationId: cleanText(payload.formationId) || null,
      testCases: meta,
    },
  };
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

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const rows = await prisma.challenge.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 300,
      include: {
        formation: {
          select: { id: true, name: true },
        },
      },
    });

    const challenges = rows.map((row) => {
      const meta = readMeta(row.testCases);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        points: row.points,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        kind: meta.kind,
        theoryFormat: meta.theoryFormat,
        theoryQuestionCount: meta.theoryQuestionCount,
        estimatedMinutes: meta.estimatedMinutes,
        language: meta.language,
        formationId: row.formationId ?? meta.formationId,
        formationName: row.formation?.name ?? meta.formationName,
        tags: meta.tags,
        starterCode: meta.starterCode,
        hints: meta.hints,
        testCases: meta.testCases,
        quizQuestions: meta.quizQuestions,
        generatedPrompt: meta.generatedPrompt,
        generationSource: meta.generationSource,
        isPublished: meta.isPublished,
      };
    });

    return Response.json({ ok: true, challenges });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  let payload: AdminChallengePayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeCreatePayload(payload);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
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

  try {
    const challenge = await prisma.challenge.create({
      data: normalized.data,
    });

    return Response.json({ ok: true, challenge }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}