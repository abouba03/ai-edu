import prisma from '@/lib/prisma';

type PublicChallengeMeta = {
  kind: 'code' | 'theory';
  estimatedMinutes: number;
  language: string;
  hints: string[];
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: Array<{
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  }>;
  isPublished: boolean;
};

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseMeta(value: unknown): PublicChallengeMeta {
  if (!value || typeof value !== 'object') {
    return {
      kind: 'code',
      estimatedMinutes: 20,
      language: 'Python',
      hints: [],
      testCases: [],
      quizQuestions: [],
      isPublished: false,
    };
  }

  const raw = value as Record<string, unknown>;

  const hints = Array.isArray(raw.hints)
    ? raw.hints.map((item) => asText(item)).filter(Boolean).slice(0, 5)
    : [];

  const testCases = Array.isArray(raw.testCases)
    ? raw.testCases
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          return {
            label: asText(row.label, `Cas ${index + 1}`),
            input: asText(row.input),
            expected: asText(row.expected),
          };
        })
        .filter((row): row is { label: string; input: string; expected: string } => Boolean(row))
        .slice(0, 20)
    : [];

  const quizQuestions = Array.isArray(raw.quizQuestions)
    ? raw.quizQuestions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const question = asText(row.question);
          if (!question) return null;
          const choices = Array.isArray(row.choices)
            ? row.choices.map((choice) => asText(choice)).filter(Boolean).slice(0, 6)
            : [];
          return {
            question,
            choices,
            answer: asText(row.answer),
            explanation: asText(row.explanation),
          };
        })
        .filter((row): row is { question: string; choices: string[]; answer: string; explanation: string } => Boolean(row))
        .slice(0, 20)
    : [];

  return {
    kind: raw.kind === 'theory' ? 'theory' : 'code',
    estimatedMinutes: Math.max(5, Math.min(240, Number(raw.estimatedMinutes ?? 20) || 20)),
    language: asText(raw.language, 'Python') || 'Python',
    hints,
    testCases,
    quizQuestions,
    isPublished: Boolean(raw.isPublished),
  };
}

export async function GET() {
  try {
    const rows = await prisma.challenge.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        formation: {
          select: { id: true, name: true },
        },
      },
      take: 200,
    });

    const challenges = rows
      .map((row) => {
        const meta = parseMeta(row.testCases);
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          difficulty: row.difficulty,
          points: row.points,
          kind: meta.kind,
          estimatedMinutes: meta.estimatedMinutes,
          language: meta.language,
          formationId: row.formationId,
          formationName: row.formation?.name || 'Formation générale',
          hints: meta.hints,
          testCases: meta.testCases,
          quizQuestions: meta.quizQuestions,
          updatedAt: row.updatedAt,
          isPublished: meta.isPublished,
        };
      })
      .filter((row) => row.isPublished);

    return Response.json({ ok: true, challenges });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'challenges_load_error';
    return Response.json({ ok: false, error: 'challenges_load_error', detail }, { status: 500 });
  }
}
