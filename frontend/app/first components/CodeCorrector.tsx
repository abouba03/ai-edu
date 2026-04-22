'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import Editor, { loader } from '@monaco-editor/react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Loader2,
  Play,
  Terminal,
  Wand2,
} from 'lucide-react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const instructionPages = ['Задание', 'Правила', 'Консоль', 'Отладчик ИИ'] as const;
const testsTabIndex = instructionPages.indexOf('Консоль');
const debugTabIndex = instructionPages.indexOf('Отладчик ИИ');

function parseArrayParam(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // fallback below
  }
  return raw.split('||').map((item) => item.trim()).filter(Boolean);
}

type ParsedChallengeSections = {
  statement: string;
  constraints: string[];
  hints: string[];
  example: string;
};

type FunctionCase = {
  label: string;
  inputLiteral: string;
  expectedLiteral: string;
};

function extractFunctionCases(challenge: string, rules: string[], tests: string[]): FunctionCase[] {
  const result: FunctionCase[] = [];

  const inlineMatch = challenge.match(/Вход[^:]*:\s*([^\n]+?)\s*(?:-|->|→)\s*Выход[^:]*:\s*([^\n]+)/i);
  const separateInput = challenge.match(/Вход[^:]*:\s*([^\n]+)/i);
  const separateOutput = challenge.match(/Выход[^:]*:\s*([^\n]+)/i);

  const nominalInput = (inlineMatch?.[1] || separateInput?.[1] || '').trim();
  const nominalOutput = (inlineMatch?.[2] || separateOutput?.[1] || '').trim();

  if (nominalInput && nominalOutput) {
    result.push({
      label: 'Проверка 1',
      inputLiteral: nominalInput,
      expectedLiteral: nominalOutput,
    });
  }

  const hasEmptyCase =
    rules.some((line) => /пуст[а-я]+\s+списк/i.test(line)) ||
    tests.some((line) => /\[\s*\]/.test(line));

  if (hasEmptyCase) {
    result.push({
      label: `Проверка ${result.length + 1}`,
      inputLiteral: '[]',
      expectedLiteral: '[]',
    });
  }

  if (result.length === 0 && tests.length > 0) {
    const fromTests = tests
      .map((raw, idx) => {
        const parts = raw.split(':');
        const expected = (parts.length > 1 ? parts.slice(1).join(':') : raw).trim();
        return {
          label: `Проверка ${idx + 1}`,
          inputLiteral: '[]',
          expectedLiteral: expected,
        };
      })
      .filter((item) => item.expectedLiteral.length > 0);
    result.push(...fromTests);
  }

  const unique = new Map<string, FunctionCase>();
  for (const item of result) {
    const key = `${item.inputLiteral}::${item.expectedLiteral}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values()).slice(0, 8).map((item, index) => ({
    ...item,
    label: `Проверка ${index + 1}`,
  }));
}

function parseChallengeText(challenge: string): ParsedChallengeSections {
  const text = challenge.trim();
  if (!text) {
    return { statement: '', constraints: [], hints: [], example: '' };
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const statementLines: string[] = [];
  const constraints: string[] = [];
  const hints: string[] = [];
  const examples: string[] = [];

  let mode: 'statement' | 'constraints' | 'hints' | 'example' = 'statement';

  for (const line of lines) {
    const statementInline = line.match(/^(?:#+\s*)?(?:[eé]nonc[ée]|description|objectif|задание|условие|цель)\s*:\s*(.+)$/i);
    if (statementInline) {
      mode = 'statement';
      statementLines.push(statementInline[1].trim());
      continue;
    }

    const constraintsInline = line.match(/^(?:#+\s*)?(?:contraintes?|requirements?|r[eè]gles?|правила|ограничения|условия)\s*:\s*(.+)$/i);
    if (constraintsInline) {
      mode = 'constraints';
      constraints.push(constraintsInline[1].replace(/^[-•*]\s*/, '').trim());
      continue;
    }

    const hintsInline = line.match(/^(?:#+\s*)?(?:hints?|indices?|astuces?|подсказки|подсказка)\s*:\s*(.+)$/i);
    if (hintsInline) {
      mode = 'hints';
      hints.push(hintsInline[1].replace(/^[-•*]\s*/, '').trim());
      continue;
    }

    const exampleInline = line.match(/^(?:#+\s*)?(?:exemple|example|i\/o|entr[ée]e\/sortie|пример|вход.*выход|входной\s+список|выходной\s+список)\s*:\s*(.+)$/i);
    if (exampleInline) {
      mode = 'example';
      examples.push(exampleInline[1].trim());
      continue;
    }

    if (/^(?:#+\s*)?(?:[eé]nonc[ée]|description|objectif|задание|условие|цель)\s*:?$/i.test(line)) {
      mode = 'statement';
      continue;
    }
    if (/^(?:#+\s*)?(?:contraintes?|requirements?|r[eè]gles?|правила|ограничения|условия)\s*:?$/i.test(line)) {
      mode = 'constraints';
      continue;
    }
    if (/^(?:#+\s*)?(?:hints?|indices?|astuces?|подсказки|подсказка)\s*:?$/i.test(line)) {
      mode = 'hints';
      continue;
    }
    if (/^(?:#+\s*)?(?:exemple|example|i\/o|entr[ée]e\/sortie|пример|вход.*выход|входной\s+список|выходной\s+список)\s*:?$/i.test(line)) {
      mode = 'example';
      continue;
    }

    if (mode === 'constraints') {
      constraints.push(line.replace(/^[-•*]\s*/, '').trim());
      continue;
    }

    if (mode === 'hints') {
      hints.push(line.replace(/^[-•*]\s*/, '').trim());
      continue;
    }

    if (mode === 'example') {
      examples.push(line);
      continue;
    }

    statementLines.push(line);
  }

  return {
    statement: statementLines.join('\n').trim(),
    constraints: constraints.filter(Boolean),
    hints: hints.filter(Boolean),
    example: examples.join('\n').trim(),
  };
}

export default function CodeCorrector() {
  const searchParams = useSearchParams();

  const initialCode = searchParams.get('code') || '';
  const title = searchParams.get('title') || 'Упражнение Python';
  const level = searchParams.get('level') || 'débutant';
  const formation = searchParams.get('formation') || 'Formation Python Russe';
  const progress = searchParams.get('progress') || '0';

  const challengeRaw = searchParams.get('challenge') || '';
  const rulesParam = parseArrayParam(searchParams.get('rules'));
  const testsParam = parseArrayParam(searchParams.get('tests'));

  const parsed = useMemo(() => parseChallengeText(challengeRaw), [challengeRaw]);

  const functionName = useMemo(() => {
    const match = initialCode.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    return match?.[1] ?? null;
  }, [initialCode]);

  const displayTitle = functionName ? `Задача: ${functionName}` : 'Упражнение по Python';
  const displayLevel =
    level === 'débutant' || level === 'debutant' || level === 'начинающий'
      ? 'Начальный'
      : level === 'intermédiaire' || level === 'intermediaire' || level === 'средний'
      ? 'Средний'
      : level === 'avancé' || level === 'avance' || level === 'продвинутый'
      ? 'Продвинутый'
      : 'Начальный';
  const displayFormation = 'Курс Python';

  const statement = parsed.statement || (functionName ? `Допиши функцию ${functionName}, чтобы решить задачу.` : 'Допиши нужный код.');
  const constraints = rulesParam.length > 0 ? rulesParam : parsed.constraints;
  const hintLines = parsed.hints;

  const tests = useMemo(() => {
    if (testsParam.length > 0) return testsParam;

    const extracted: string[] = [];
    if (parsed.example) extracted.push(parsed.example);

    const commentTests = initialCode
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('#'))
      .map((line) => line.replace(/^#\s?/, '').trim())
      .filter((line) => /print\(|test|doit afficher/i.test(line));

    extracted.push(...commentTests);
    return Array.from(new Set(extracted)).slice(0, 8);
  }, [testsParam, parsed.example, initialCode]);

  const [code, setCode] = useState(initialCode);
  const [correctedCode, setCorrectedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [hintQuestion, setHintQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [instructionPage, setInstructionPage] = useState(0);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [consoleTestResults, setConsoleTestResults] = useState<Array<{ label: string; expected: string; passed: boolean }>>([]);
  const [consoleTestSummary, setConsoleTestSummary] = useState<{ passed: number; total: number } | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugStep, setDebugStep] = useState(0);
  const [debugResponse, setDebugResponse] = useState('');
  const [debugAnswer, setDebugAnswer] = useState('');

  const currentFunctionName = useMemo(() => {
    const match = code.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    return match?.[1] ?? null;
  }, [code]);

  const functionCases = useMemo(
    () => extractFunctionCases(challengeRaw, constraints, tests),
    [challengeRaw, constraints, tests]
  );

  const linesCount = useMemo(() => {
    if (!code.trim()) return 0;
    return code.split('\n').length;
  }, [code]);

  const handleCorrect = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const response = await axios.post(`${apiBaseUrl}/correct/`, {
        code,
        pedagogy_context: {
          level: level === 'avancé' || level === 'intermédiaire' || level === 'débutant' ? level : 'intermédiaire',
          pedagogicalStyle: 'Correction explicative',
          aiTone: 'Tuteur pédagogique',
        },
      });
      setCorrectedCode(response.data.corrected_code || '');
      setExplanation(response.data.explanation || '');
      setHintQuestion(response.data.hint_question || '');
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка при исправлении кода';
      setError(message);
      setCorrectedCode('');
      setExplanation('');
      setHintQuestion('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!correctedCode.trim()) return;
    try {
      await navigator.clipboard.writeText(correctedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleRunConsole = async () => {
    if (!code.trim()) {
      setConsoleOutput('Ошибка: добавьте код для запуска.');
      return;
    }

    setRunLoading(true);
    try {
      const shouldUseFunctionHarness = Boolean(currentFunctionName && functionCases.length > 0);
      const harnessCode = shouldUseFunctionHarness
        ? `${code}\n\nimport ast\n__CC_CASES = ${JSON.stringify(functionCases)}\nfor __case in __CC_CASES:\n    __label = str(__case.get("label") or "Проверка")\n    __label = __label.replace("|", "/")\n    __input_literal = str(__case.get("inputLiteral") or "[]")\n    __expected_literal = str(__case.get("expectedLiteral") or "")\n    try:\n        __inp = ast.literal_eval(__input_literal)\n    except Exception:\n        __inp = __input_literal\n    try:\n        __expected = ast.literal_eval(__expected_literal)\n    except Exception:\n        __expected = __expected_literal\n    try:\n        __actual = ${currentFunctionName}(__inp)\n        __ok = __actual == __expected\n        print(f"__CC_TEST__|{__label}|{repr(__expected)}|{repr(__actual)}|{1 if __ok else 0}")\n    except Exception as __e:\n        print(f"__CC_TEST__|{__label}|{repr(__expected)}|<exception: {str(__e)}>|0")\n`
        : code;

      const response = await axios.post(`${apiBaseUrl}/execute-console/`, {
        code: harnessCode,
        stdin_lines: [],
      });

      let outputText = '';
      if (response.data?.success) {
        const stdout = String(response.data?.stdout ?? '');
        const stdoutLines = stdout.split(/\r?\n/);
        const markerLines = stdoutLines.filter((line) => line.startsWith('__CC_TEST__|'));
        const visibleLines = stdoutLines.filter((line) => !line.startsWith('__CC_TEST__|'));

        outputText = visibleLines.join('\n').trim() || '(нет вывода)';
        setConsoleOutput(outputText);

        if (markerLines.length > 0) {
          const parsedResults = markerLines.map((line, idx) => {
            const parts = line.split('|');
            const label = (parts[1] || `Проверка ${idx + 1}`).trim();
            const expected = (parts[2] || '').trim();
            const passed = (parts[4] || '0').trim() === '1';
            return { label, expected, passed };
          });
          const passedCount = parsedResults.filter((item) => item.passed).length;
          setConsoleTestResults(parsedResults);
          setConsoleTestSummary({ passed: passedCount, total: parsedResults.length });
          return;
        }
      } else {
        const stdout = String(response.data?.stdout ?? '');
        const errorText = String(response.data?.error ?? 'execution_error');
        const traceText = String(response.data?.trace ?? '');
        outputText = `${stdout ? `${stdout}\n` : ''}Ошибка: ${errorText}${traceText ? `\n${traceText}` : ''}`;
        setConsoleOutput(outputText);
      }

      if (tests.length > 0) {
        const normalizedOut = outputText.toLowerCase();
        const parsedResults = tests.map((raw, idx) => {
          const parts = raw.split(':');
          const expected = (parts.length > 1 ? parts.slice(1).join(':') : raw).trim();
          const label = `Проверка ${idx + 1}`;
          const passed = expected.length > 0 && normalizedOut.includes(expected.toLowerCase());
          return { label, expected, passed };
        });
        const passedCount = parsedResults.filter((item) => item.passed).length;
        setConsoleTestResults(parsedResults);
        setConsoleTestSummary({ passed: passedCount, total: parsedResults.length });
      } else {
        setConsoleTestResults([]);
        setConsoleTestSummary(null);
      }
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка запуска кода';
      setConsoleOutput(`Ошибка: ${message}`);
      setConsoleTestResults([]);
      setConsoleTestSummary(null);
    } finally {
      setRunLoading(false);
    }
  };

  const runFromEditor = async () => {
    setInstructionPage(testsTabIndex >= 0 ? testsTabIndex : 0);
    await handleRunConsole();
  };

  const normalizeLevel = (rawLevel: string) => {
    if (rawLevel === 'débutant' || rawLevel === 'intermédiaire' || rawLevel === 'avancé') return rawLevel;
    return 'débutant';
  };

  const handleStartDebugger = async () => {
    if (!code.trim()) {
      setDebugResponse('Сначала добавь код в редактор, затем запусти анализ.');
      return;
    }

    setDebugLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code,
        challenge_description: challengeRaw || statement,
        level: normalizeLevel(level),
        step: 0,
        student_answer: '',
        session_id: null,
        pedagogy_context: {
          level: normalizeLevel(level),
          pedagogicalStyle: 'Debug guidé socratique',
          aiTone: 'Coach concis et actionnable',
          targetAudience: formation,
        },
      });

      setDebugSessionId(res.data.session_id ?? null);
      setDebugStep(Number(res.data.step ?? 1));
      setDebugResponse(String(res.data.response ?? ''));
      setDebugAnswer('');
      setInstructionPage(debugTabIndex >= 0 ? debugTabIndex : 0);
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Ошибка направленной отладки.';
      setDebugResponse(String(message));
    } finally {
      setDebugLoading(false);
    }
  };

  const handleSendDebuggerReply = async () => {
    if (!debugSessionId || !debugAnswer.trim()) return;

    setDebugLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code,
        challenge_description: challengeRaw || statement,
        level: normalizeLevel(level),
        step: debugStep + 1,
        student_answer: debugAnswer,
        session_id: debugSessionId,
        pedagogy_context: {
          level: normalizeLevel(level),
          pedagogicalStyle: 'Debug guidé socratique',
          aiTone: 'Coach concis et actionnable',
          targetAudience: formation,
        },
      });

      setDebugSessionId(res.data.session_id ?? debugSessionId);
      setDebugStep(Number(res.data.step ?? debugStep + 1));
      setDebugResponse(String(res.data.response ?? ''));
      setDebugAnswer('');
    } catch (e: any) {
      const message = e?.response?.data?.detail || 'Не удалось отправить ответ на отладку.';
      setDebugResponse(String(message));
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-3 pb-4">
      <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-3 shadow-[2px_2px_0px_0px_#1C293C] flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Назад к курсу
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Мини-задание</p>
          <h1 className="font-black text-sm text-[#1C293C] mt-0.5">{displayTitle}</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{displayLevel}</span>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{progress}%</span>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{displayFormation}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <aside className="xl:col-span-5 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-3 space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {instructionPages.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setInstructionPage(index)}
                className={`border-2 px-2.5 py-1 text-xs font-black transition-all duration-100 ${
                  instructionPage === index
                    ? 'border-[#1C293C] bg-[#FDC800] text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]'
                    : 'border-[#1C293C]/30 text-[#1C293C]/60 hover:border-[#1C293C] hover:text-[#1C293C]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2 min-h-[280px]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">
              Страница {instructionPage + 1}/{instructionPages.length}
            </p>
            <div className="max-h-[52vh] overflow-y-auto pr-1">
              {instructionPages[instructionPage] === 'Задание' && (
                <div className="space-y-1.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Цель</p>
                    <p className="text-[12px] leading-relaxed text-[#1C293C] whitespace-pre-wrap">{statement}</p>
                  </div>
                </div>
              )}

              {instructionPages[instructionPage] === 'Правила' && (
                <div className="space-y-1.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Правила</p>
                      <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">
                        {(constraints.length > 0 ? constraints : hintLines).length || 3} правил
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {(constraints.length > 0
                        ? constraints
                        : hintLines.length > 0
                        ? hintLines
                        : [
                            'Пишите только исполняемый Python-код.',
                            'Соблюдай входы/выходы из задания.',
                            'Проверяй граничные условия.',
                          ]
                      ).map((item, index) => (
                        <div key={`${item}-${index}`} className="border border-[#1C293C]/20 bg-white px-2 py-1.5">
                          <p className="text-[11px] leading-relaxed text-[#1C293C]">{index + 1}. {item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {instructionPages[instructionPage] === 'Консоль' && (
                <div className="space-y-2.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FDC800]/20 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]">Панель проверки</p>
                      <div className="flex items-center gap-1.5">
                        <span className="border border-[#1C293C]/25 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/70">
                          Проверки: {tests.length}
                        </span>
                        <span className="border border-[#1C293C]/25 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/70">
                          Строк кода: {linesCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5" /> Консоль
                      </p>
                      <button
                        type="button"
                        onClick={handleRunConsole}
                        disabled={runLoading || !code.trim()}
                        className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-2.5 py-1 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
                      >
                        {runLoading ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Запуск...</>
                        ) : (
                          <><Play className="h-3.5 w-3.5" /> Запустить</>
                        )}
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-[#1C293C]/60">Выполняется только код из редактора.</p>

                    {consoleOutput !== null && (
                      <div className="mt-1 border-2 border-[#1C293C] overflow-hidden">
                        <div className="flex items-center justify-between gap-2 bg-[#1C293C] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-widest font-black text-[#FDC800]">Результат</p>
                          <button
                            type="button"
                            onClick={() => {
                              setConsoleOutput(null);
                              setConsoleTestResults([]);
                              setConsoleTestSummary(null);
                            }}
                            className="text-[10px] font-bold text-white/70 hover:text-white"
                          >
                            Очистить
                          </button>
                        </div>
                        <pre className="max-h-[230px] overflow-auto bg-[#0D1117] px-2 py-2 text-[11px] leading-relaxed text-[#E6EDF3] whitespace-pre-wrap">
                          {consoleOutput}
                        </pre>
                      </div>
                    )}

                    {consoleTestSummary && (
                      <div className="mt-1 border-2 border-[#1C293C] bg-white p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Статус проверок</p>
                          <span className={`border-2 px-2 py-0.5 text-[10px] font-black ${
                            consoleTestSummary.passed === consoleTestSummary.total
                              ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                              : 'border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]'
                          }`}>
                            {consoleTestSummary.passed}/{consoleTestSummary.total}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-1.5">
                          {consoleTestResults.map((item, index) => (
                            <div key={`${item.label}-${index}`} className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-black text-[#1C293C]">{item.label}</p>
                                <span className={`text-[10px] font-black ${item.passed ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                  {item.passed ? 'OK' : 'KO'}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#1C293C]/60">Ожидается: {item.expected}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {instructionPages[instructionPage] === 'Отладчик ИИ' && (
                <div className="space-y-1.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5">
                    <div className="border-2 border-[#1C293C] bg-white p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
                          <Bug className="h-3.5 w-3.5" /> Отладчик ИИ
                        </p>
                        <button
                          type="button"
                          onClick={handleStartDebugger}
                          disabled={debugLoading || !code.trim()}
                          className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] px-2.5 py-1 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
                        >
                          {debugLoading ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Анализ...</>
                          ) : (
                            'Анализировать'
                          )}
                        </button>
                      </div>

                      {debugResponse ? (
                        <div className="border border-[#1C293C]/20 bg-[#FBFBF9] p-2">
                          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#1C293C]">{debugResponse}</pre>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#1C293C]/60">Запусти анализ, чтобы получить разбор ошибки и следующую подсказку.</p>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={debugAnswer}
                          onChange={(e) => setDebugAnswer(e.target.value)}
                          placeholder="Задай уточняющий вопрос по ошибке..."
                          className="w-full border-2 border-[#1C293C] bg-white px-2 py-1.5 text-[11px] text-[#1C293C] placeholder:text-[#1C293C]/40 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSendDebuggerReply}
                          disabled={debugLoading || !debugSessionId || !debugAnswer.trim()}
                          className="border-2 border-[#1C293C] bg-[#432DD7] px-3 py-1.5 text-[11px] font-black text-white shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
                        >
                          Отправить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={instructionPage === 0}
              onClick={() => setInstructionPage((value) => Math.max(0, value - 1))}
              className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Назад
            </button>
            <button
              type="button"
              disabled={instructionPage === instructionPages.length - 1}
              onClick={() => setInstructionPage((value) => Math.min(instructionPages.length - 1, value + 1))}
              className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Далее <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>

        <div className="xl:col-span-7 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Зона кода Python
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runFromEditor}
                disabled={runLoading || !code.trim()}
                className="border-2 border-[#1C293C] bg-white px-4 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {runLoading ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Запуск...</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Play className="h-3.5 w-3.5" /> Запустить</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleCorrect}
                disabled={loading || !code.trim()}
                className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Проверяю...</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Отправить решение</span>
                )}
              </button>
            </div>
          </div>

          <div className="border-2 border-[#1C293C] overflow-hidden">
            <Editor
              height="380px"
              defaultLanguage="python"
              value={code}
              onChange={(value) => setCode(value || '')}
              loading={
                <div className="flex items-center justify-center h-[380px] bg-[#1e1e1e]">
                  <p className="text-xs text-white/40">Загрузка редактора...</p>
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 4,
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap border-2 border-[#1C293C] bg-white p-2">
            <span className="text-[11px] font-semibold text-[#1C293C]/60">Строк: {linesCount}</span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!correctedCode.trim()}
              className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FBFBF9] px-3 py-1 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Скопировано' : 'Копировать исправление'}
            </button>
          </div>

          {error && (
            <div className="border-2 border-[#DC2626]/40 bg-[#DC2626]/5 p-2 text-xs text-[#DC2626] inline-flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {correctedCode && (
            <div className="border-2 border-[#1C293C] bg-white p-2.5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Исправленный код</p>
              <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed border-2 border-[#1C293C] bg-[#FBFBF9] p-2 text-[#1C293C]">
                {correctedCode}
              </pre>
            </div>
          )}

          {explanation && (
            <div className="border-2 border-[#1C293C] bg-white p-2.5 space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Объяснение</p>
              <p className="text-[11px] leading-relaxed text-[#1C293C]/80 whitespace-pre-wrap">{explanation}</p>
            </div>
          )}

          {hintQuestion && (
            <div className="border-2 border-[#1C293C] bg-[#FDC800]/30 p-2.5 space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Проверочный вопрос</p>
              <p className="text-[11px] leading-relaxed text-[#1C293C] inline-flex gap-1.5 items-start">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-[#432DD7]" />
                <span>{hintQuestion}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
