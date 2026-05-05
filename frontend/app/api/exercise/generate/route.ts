import { callOpenAI, parseJsonFromText } from '@/lib/generator-ai/openai';
import { auth } from '@clerk/nextjs/server';
import { getExerciseSupabaseClient } from '../_lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIFFICULTY_TOPICS: Record<number, string> = {
  1: 'переменные, базовые типы, print, простой input',
  2: 'условия if/else, логические операторы, преобразование типов',
  3: 'циклы for/while, range, break/continue, простые списки',
  4: 'функции с параметрами и return, область видимости, простая рекурсия',
  5: 'продвинутые списки (срезы, comprehensions), кортежи, словари',
  6: 'строки, файлы, исключения try/except',
  7: 'классы и объекты, простое наследование, специальные методы',
  8: 'сортировка, поиск, сложность, рекурсия',
  9: 'декораторы, генераторы, итераторы, функциональный стиль',
  10: 'паттерны проектирования, оптимизация, сложные структуры данных',
};

function difficultyToLabel(d: number): string {
  if (d <= 3) return 'debutant';
  if (d <= 6) return 'intermediaire';
  return 'avance';
}

const DEFAULT_STARTER = 'def solution(*args):\n    """Добавь решение здесь."""\n    pass';
const DRAFT_MARKER = '# EXERCISE_CHALLENGE_DRAFT';
const CYRILLIC_RE = /[А-Яа-яЁё]/;

function hasCyrillic(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return CYRILLIC_RE.test(value);
}

function normalizeConcept(value: unknown): string {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length > 40 ? `${raw.slice(0, 39).trim()}…` : raw;
}

function extractConceptsFromContraintes(contraintes: string[], max = 4): string[] {
  const out: string[] = [];
  for (const item of contraintes) {
    const concept = normalizeConcept(item.replace(/^[-•\d\.)\s]+/, ''));
    if (!concept) continue;
    if (!out.includes(concept)) out.push(concept);
    if (out.length >= max) break;
  }
  return out;
}

function isRussianEnough(payload: {
  challenge: string;
  challenge_json: {
    enonce: string;
    contraintes: string[];
    concepts?: string[];
    hints: string[];
    exemple: string;
    starter_code: string;
  };
}): boolean {
  const probes = [
    payload.challenge,
    payload.challenge_json.enonce,
    payload.challenge_json.exemple,
    ...payload.challenge_json.contraintes,
    ...(payload.challenge_json.concepts ?? []),
    ...payload.challenge_json.hints,
  ];

  const withCyrillic = probes.filter((item) => hasCyrillic(item)).length;
  return withCyrillic >= 3;
}

async function rewritePayloadToSimpleRussian(inputPayload: {
  challenge: string;
  challenge_json: {
    enonce: string;
    contraintes: string[];
    concepts?: string[];
    hints: string[];
    exemple: string;
    starter_code: string;
  };
  starter_code: string;
  challenge_tests: {
    mode: 'function';
    function_name: string;
    test_cases: Array<{ name: string; args_literal: string; expected_literal: string }>;
    quality_checks: string[];
  };
  difficulty: number;
  level: string;
}): Promise<typeof inputPayload | null> {
  const system = [
    'Ты редактор локализации.',
    'Перепиши ВСЕ учебные тексты на простой русский язык.',
    'Разрешено оставить имена функций/переменных на английском (snake_case).',
    'Не ломай структуру JSON. Верни только валидный JSON без пояснений.',
    'Не меняй args_literal/expected_literal кроме языка в поле name.',
    'starter_code должен остаться исполняемым Python-кодом.',
  ].join('\n');

  const user = [
    'Перепиши этот JSON в простой русский язык:',
    JSON.stringify(inputPayload, null, 2),
  ].join('\n\n');

  try {
    const rewrittenRaw = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      maxTokens: 2600,
    });

    const rewritten = parseJsonFromText<typeof inputPayload>(rewrittenRaw);
    if (!rewritten) return null;

    return {
      ...inputPayload,
      ...rewritten,
      challenge: String(rewritten.challenge ?? inputPayload.challenge).trim() || inputPayload.challenge,
      challenge_json: {
        enonce: String(rewritten.challenge_json?.enonce ?? inputPayload.challenge_json.enonce).trim() || inputPayload.challenge_json.enonce,
        contraintes: Array.isArray(rewritten.challenge_json?.contraintes)
          ? rewritten.challenge_json.contraintes.map(String).filter(Boolean)
          : inputPayload.challenge_json.contraintes,
        concepts: Array.isArray(rewritten.challenge_json?.concepts)
          ? rewritten.challenge_json.concepts.map(String).filter(Boolean).slice(0, 4)
          : inputPayload.challenge_json.concepts,
        hints: Array.isArray(rewritten.challenge_json?.hints)
          ? rewritten.challenge_json.hints.map(String).filter(Boolean)
          : inputPayload.challenge_json.hints,
        exemple: String(rewritten.challenge_json?.exemple ?? inputPayload.challenge_json.exemple).trim(),
        starter_code: String(rewritten.challenge_json?.starter_code ?? rewritten.starter_code ?? inputPayload.starter_code).trim() || inputPayload.starter_code,
      },
      starter_code: String(rewritten.starter_code ?? rewritten.challenge_json?.starter_code ?? inputPayload.starter_code).trim() || inputPayload.starter_code,
      challenge_tests: {
        ...inputPayload.challenge_tests,
        ...rewritten.challenge_tests,
        function_name: String(rewritten.challenge_tests?.function_name ?? inputPayload.challenge_tests.function_name).trim() || inputPayload.challenge_tests.function_name,
        test_cases: Array.isArray(rewritten.challenge_tests?.test_cases)
          ? rewritten.challenge_tests.test_cases.map((t, i) => ({
              name: String(t?.name ?? inputPayload.challenge_tests.test_cases[i]?.name ?? `test_${i + 1}`).trim(),
              args_literal: String(t?.args_literal ?? inputPayload.challenge_tests.test_cases[i]?.args_literal ?? '[]').trim(),
              expected_literal: String(t?.expected_literal ?? inputPayload.challenge_tests.test_cases[i]?.expected_literal ?? 'None').trim(),
            }))
          : inputPayload.challenge_tests.test_cases,
        quality_checks: Array.isArray(rewritten.challenge_tests?.quality_checks)
          ? rewritten.challenge_tests.quality_checks.map(String).filter(Boolean)
          : inputPayload.challenge_tests.quality_checks,
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    await req.json();
  } catch {
    // body is optional for this endpoint
  }

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

  const supabase = getExerciseSupabaseClient();

  let difficulty = 1;
  let level = difficultyToLabel(difficulty);
  let sessionId = '';

  try {
    const sessionLookup = await supabase
      .from('ExerciseSession')
      .select('*')
      .eq('clerkId', clerkId)
      .maybeSingle();

    if (sessionLookup.error) {
      return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
    }

    const sessionRow = sessionLookup.data;
    if (sessionRow) {
      difficulty = Number(sessionRow.difficulty ?? 1) || 1;
      level = difficultyToLabel(difficulty);
      sessionId = String(sessionRow.id);
    } else {
      sessionId = crypto.randomUUID();
      const createSession = await supabase.from('ExerciseSession').insert({
        id: sessionId,
        clerkId,
        level: 'debutant',
        difficulty: 1,
        totalPoints: 0,
        passedCount: 0,
        failedCount: 0,
        consecutiveWins: 0,
      });

      if (createSession.error) {
        return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
      }

      difficulty = 1;
      level = difficultyToLabel(difficulty);
    }
  } catch {
    return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
  }

  const topics = DIFFICULTY_TOPICS[difficulty] ?? DIFFICULTY_TOPICS[1];

  const system = [
    'Ты опытный методист по Python. Отвечай только простым русским языком.',
    '',
    'ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:',
    '1) enonce: 3-5 предложений. Практичный контекст. Точно укажи вход и ожидаемый выход.',
    '2) contraintes: 3-5 технических ограничений по уровню ученика. Ограничения должны включать 2-4 разных концепта.',
    '3) concepts: массив из 2-4 коротких концептов (например: "Циклы", "Словари", "Функции").',
    '4) hints: 2-3 подсказки по шагам, без готового решения. Подсказки должны явно вести по этапам решения.',
    '5) решение задачи должно требовать минимум 2 шага (лучше 2-3 шага) и объединять несколько концептов.',
    '4) exemple: один конкретный пример. Формат: "input: ... -> output: ...".',
    '6) starter_code: чистый шаблон Python с правильной сигнатурой функции. В теле только "pass".',
    '7) challenge_tests: минимум 5 тестов (базовый, крайний, негативный, типичный, сложный).',
    '8) function_name: понятное имя snake_case, соответствует условию.',
    '9) Верни только валидный JSON, без лишнего текста.',
  ].join('\n');

  const user = [
    `Уровень сложности: ${difficulty}/10 (${level})`,
    `Целевые навыки уровня: ${topics}`,
    '',
    'Сгенерируй задачу по Python:',
    '- строго под этот уровень сложности',
    '- практичную и мотивирующую (реальная ситуация)',
    '- решаемую за 10-20 минут',
    '- с 2-3 этапами решения (не одношаговая)',
    '- с комбинацией нескольких концептов уровня',
    '- с автоматической проверкой через unit-тесты',
    '',
    'Ожидаемый JSON формат:',
    JSON.stringify({
      challenge: 'Полное описание задачи для ученика',
      challenge_json: {
        enonce: 'Понятное условие (3-5 предложений)',
        contraintes: ['ограничение 1', 'ограничение 2'],
        concepts: ['концепт 1', 'концепт 2'],
        hints: ['общая подсказка', 'более точная подсказка'],
        exemple: 'input: ... → output: ...',
        starter_code: 'def имя_функции(...):\n    """Одна строка."""\n    pass',
      },
      starter_code: 'def имя_функции(...):\n    """Одна строка."""\n    pass',
      challenge_tests: {
        mode: 'function',
        function_name: 'имя_функции',
        test_cases: [
          { name: 'базовый_случай', args_literal: '[значение]', expected_literal: 'ожидаемое_значение' },
        ],
        quality_checks: ['критерий 1', 'критерий 2', 'критерий 3'],
      },
    }, null, 2),
  ].join('\n');

  try {
    const raw = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      maxTokens: 2800,
    });

    const parsed = parseJsonFromText<Record<string, unknown>>(raw);
    const challengeJson = (parsed?.challenge_json && typeof parsed.challenge_json === 'object')
      ? parsed.challenge_json as Record<string, unknown>
      : {};
    const challengeTests = (parsed?.challenge_tests && typeof parsed.challenge_tests === 'object')
      ? parsed.challenge_tests as Record<string, unknown>
      : {};

    const starter = String(parsed?.starter_code ?? challengeJson?.starter_code ?? DEFAULT_STARTER).trim() || DEFAULT_STARTER;
    const challenge = String(parsed?.challenge ?? challengeJson?.enonce ?? `Задача уровня ${difficulty}`).trim();

    const payload = {
      challenge,
      challenge_json: {
        enonce: String(challengeJson?.enonce ?? challenge).trim(),
        contraintes: Array.isArray(challengeJson?.contraintes)
          ? (challengeJson.contraintes as unknown[]).map(String).filter(Boolean)
          : ['Напиши корректную и понятную функцию.'],
        concepts: Array.isArray(challengeJson?.concepts)
          ? (challengeJson.concepts as unknown[]).map(normalizeConcept).filter(Boolean).slice(0, 4)
          : extractConceptsFromContraintes(
              Array.isArray(challengeJson?.contraintes)
                ? (challengeJson.contraintes as unknown[]).map(String).filter(Boolean)
                : ['Базовая логика решения']
            ),
        hints: Array.isArray(challengeJson?.hints)
          ? (challengeJson.hints as unknown[]).map(String).filter(Boolean)
          : ['Начни с простого случая.'],
        exemple: String(challengeJson?.exemple ?? '').trim(),
        starter_code: starter,
      },
      starter_code: starter,
      challenge_tests: {
        mode: 'function' as const,
        function_name: String(challengeTests?.function_name ?? 'solution').trim() || 'solution',
        test_cases: Array.isArray(challengeTests?.test_cases) && (challengeTests.test_cases as unknown[]).length > 0
          ? (challengeTests.test_cases as Record<string, unknown>[]).map((t, i) => ({
              name: String(t.name ?? `test_${i + 1}`).trim(),
              args_literal: String(t.args_literal ?? '[]').trim(),
              expected_literal: String(t.expected_literal ?? 'None').trim(),
            }))
          : [
              { name: 'простой_случай', args_literal: '[1]', expected_literal: '1' },
              { name: 'случай_ноль', args_literal: '[0]', expected_literal: '0' },
            ],
        quality_checks: Array.isArray(challengeTests?.quality_checks)
          ? (challengeTests.quality_checks as unknown[]).map(String).filter(Boolean)
          : ['Код читабельный', 'Крайние случаи покрыты'],
      },
      difficulty,
      level,
    };

    const finalPayload = isRussianEnough(payload)
      ? payload
      : (await rewritePayloadToSimpleRussian(payload)) ?? payload;

    try {
      const insertAttempt = await supabase.from('ExerciseAttempt').insert({
        id: crypto.randomUUID(),
        clerkId,
        sessionId,
        challengeTitle: finalPayload.challenge.slice(0, 80),
        challengeJson: finalPayload.challenge_json,
        submittedCode: `${DRAFT_MARKER}\n${finalPayload.starter_code}`,
        score: 0,
        passed: false,
        pointsEarned: 0,
        difficulty,
        evaluation: {
          kind: 'generated_challenge',
          challenge: finalPayload.challenge,
          challenge_tests: finalPayload.challenge_tests,
        },
      });

      if (insertAttempt.error) {
        return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
      }
    } catch {
      return Response.json({ detail: 'db_temporarily_unavailable' }, { status: 503 });
    }

    return Response.json(finalPayload);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Ошибка генерации';
    return Response.json({ detail }, { status: 502 });
  }
}
