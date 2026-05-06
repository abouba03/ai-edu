'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

let monacoLoaderConfigured = false;
const configureMonacoLoader = async () => {
  if (monacoLoaderConfigured) return;
  monacoLoaderConfigured = true;
  try {
    const monacoModule = await import('@monaco-editor/react');
    monacoModule.loader.config({
      paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' },
    });
  } catch {}
};
import axios from 'axios';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Code2, Lightbulb, PlayCircle } from 'lucide-react';
import { trackEvent } from '@/lib/event-tracker';
import type { ParsedChallengeFeedback } from './_components/types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const instructionPages = ['Задание', 'Правила', 'Тесты', 'Отладка'] as const;

type ChallengeTests = {
  mode?: string;
  function_name?: string;
  test_cases?: Array<{
    name?: string;
    args_literal?: string;
    expected_literal?: string;
    constraint?: string;
    stdin_lines?: string[];
    expected_stdout?: string;
  }>;
  quality_checks?: string[];
};

type AttemptItem = {
  at: string;
  status: 'validated' | 'failed';
  note: string;
};

function buildExerciseId(challengeText: string, challengeTests: ChallengeTests | null): string {
  const seed = `${challengeText || ''}::${JSON.stringify(challengeTests || {})}`;
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(index);
    hash |= 0;
  }
  return `ex-${Math.abs(hash)}`;
}

function getExerciseStorageKeys(courseSlug: string, exerciseId: string) {
  const base = `course:${courseSlug}:miniChallenge:${exerciseId}`;
  return {
    attemptsKey: `${base}:attempts`,
    completedKey: `${base}:completed`,
    historyKey: `${base}:history`,
  };
}

function levelToQuiz(level: string): 'débutant' | 'intermédiaire' | 'avancé' {
  const normalized = level.toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

export default function CourseMiniChallengePage() {
  const { userId } = useAuth();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const courseSlug = params?.slug ?? '';
  const courseTitle = searchParams.get('title') || 'Cours';
  const courseDescription = searchParams.get('description') || '';
  const courseLevel = searchParams.get('level') || 'débutant';
  const formationName = searchParams.get('formation') || 'Formation';
  const progressPercent = Number(searchParams.get('progress') || '0');

  const [challenge, setChallenge] = useState('');
  const [challengeTests, setChallengeTests] = useState<ChallengeTests | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeFeedback, setChallengeFeedback] = useState('');
  const [, setIsGeneratingChallenge] = useState(false);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [attemptHistory, setAttemptHistory] = useState<AttemptItem[]>([]);
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [currentExerciseId, setCurrentExerciseId] = useState<string>('');
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugStep, setDebugStep] = useState(0);
  const [debugResponse, setDebugResponse] = useState('');
  const [debugAnswer, setDebugAnswer] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);

  const [instructionPage, setInstructionPage] = useState(0);
  const [testsTabHighlight, setTestsTabHighlight] = useState(false);
  const testsTabIndex = instructionPages.indexOf('Тесты');
  const exerciseStartedAtRef = useRef<number>(Date.now());
  const lastTabOpenAtRef = useRef<number>(Date.now());
  const lastTrackedCodeRef = useRef<string>('');
  const hasTrackedFirstEditRef = useRef<boolean>(false);
  const hasTrackedCompletionRef = useRef<boolean>(false);

  const canResolve = attemptCount >= 5 && !challengeCompleted && !!challengeCode.trim();

  function loadExerciseProgress(exerciseId: string) {
    if (typeof window === 'undefined' || !exerciseId) {
      setAttemptCount(0);
      setChallengeCompleted(false);
      setAttemptHistory([]);
      return;
    }

    const { attemptsKey, completedKey, historyKey } = getExerciseStorageKeys(courseSlug, exerciseId);
    const storedAttempts = Number(window.localStorage.getItem(attemptsKey) || '0');
    setAttemptCount(Number.isFinite(storedAttempts) ? storedAttempts : 0);
    setChallengeCompleted(window.localStorage.getItem(completedKey) === 'true');

    try {
      const raw = window.localStorage.getItem(historyKey);
      if (!raw) {
        setAttemptHistory([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setAttemptHistory(
          parsed
            .filter((item): item is AttemptItem => (
              Boolean(item)
              && typeof item.at === 'string'
              && (item.status === 'validated' || item.status === 'failed')
              && typeof item.note === 'string'
            ))
            .slice(0, 6)
        );
      }
    } catch {
      setAttemptHistory([]);
    }
  }

  const parsedChallengeFeedback = useMemo<ParsedChallengeFeedback>(() => {
    const raw = challengeFeedback.trim();
    if (!raw) {
      return {
        promptVersion: null as string | null,
        note: null as string | null,
        comment: '',
        consignes: [] as string[],
        idees: [] as string[],
        nextSteps: [] as string[],
        evaluationMode: null as string | null,
        testSummary: null as { passed: number; total: number; all_passed: boolean; runtime_error: string } | null,
        testResults: [] as Array<{ name: string; status: 'passed' | 'failed' | 'error'; input: string; expected: string; actual: string; error?: string }>,
        extra: '',
        raw: '',
      };
    }

    const normalized = raw.startsWith('```')
      ? raw.replace(/^```(?:json|python)?\n?/i, '').replace(/```$/i, '').trim()
      : raw;

    try {
      const parsed = JSON.parse(normalized) as {
        prompt_version?: string;
        note?: string;
        commentaire?: string;
        comment?: string;
        consignes?: string[];
        idees?: string[];
        prochaines_etapes?: string[];
        evaluation_mode?: string;
        test_summary?: {
          passed?: number;
          total?: number;
          all_passed?: boolean;
          runtime_error?: string;
        };
        test_results?: Array<{
          name?: string;
          status?: string;
          input?: string;
          expected?: string;
          actual?: string;
          error?: string;
        }>;
      };

      const jsonComment = (parsed.commentaire ?? parsed.comment ?? '').trim();
      const consignes = Array.isArray(parsed.consignes) ? parsed.consignes.filter((item): item is string => typeof item === 'string') : [];
      const idees = Array.isArray(parsed.idees) ? parsed.idees.filter((item): item is string => typeof item === 'string') : [];
      const nextSteps = Array.isArray(parsed.prochaines_etapes)
        ? parsed.prochaines_etapes.filter((item): item is string => typeof item === 'string')
        : [];
      const evaluationMode = typeof parsed.evaluation_mode === 'string' ? parsed.evaluation_mode : null;

      const testSummary = parsed.test_summary
        ? {
            passed: Number(parsed.test_summary.passed ?? 0),
            total: Number(parsed.test_summary.total ?? 0),
            all_passed: Boolean(parsed.test_summary.all_passed),
            runtime_error: String(parsed.test_summary.runtime_error ?? ''),
          }
        : null;

      const testResults = Array.isArray(parsed.test_results)
        ? parsed.test_results
            .filter((item): item is { name: string; status: 'passed' | 'failed' | 'error'; input: string; expected: string; actual: string; error?: string } => (
              Boolean(item)
              && typeof item.name === 'string'
              && (item.status === 'passed' || item.status === 'failed' || item.status === 'error')
              && typeof item.input === 'string'
              && typeof item.expected === 'string'
              && typeof item.actual === 'string'
            ))
        : [];

      return {
        promptVersion: parsed.prompt_version ?? null,
        note: parsed.note?.trim() ?? null,
        comment: jsonComment,
        consignes,
        idees,
        nextSteps,
        evaluationMode,
        testSummary,
        testResults,
        extra: '',
        raw,
      };
    } catch {
      // fallback text parsing below
    }

    const noteMatch = raw.match(/Note:\s*([^\n]+)/i);

    const withoutNote = raw.replace(/Note:\s*[^\n]+\n?/i, '').trim();
    const withoutCode = withoutNote.replace(/```(?:python)?\n[\s\S]*?```/i, '').trim();

    const commentMatch = withoutCode.match(/Commentaire:\s*([\s\S]*)/i);
    const comment = commentMatch ? commentMatch[1].trim() : withoutCode;

    let extra = '';
    if (commentMatch) {
      const commentBlock = commentMatch[0];
      extra = withoutCode.replace(commentBlock, '').trim();
    }

    return {
      promptVersion: null,
      note: noteMatch ? noteMatch[1].trim() : null,
      comment,
      consignes: [],
      idees: [],
      nextSteps: [],
      evaluationMode: null,
      testSummary: null,
      testResults: [],
      extra,
      raw,
    };
  }, [challengeFeedback]);

  const challengeSections = useMemo(() => {
    const text = challenge.trim();
    if (!text) {
      return {
        statement: '',
        constraints: [] as string[],
        example: '',
      };
    }

    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    const statementLines: string[] = [];
    const constraints: string[] = [];
    const examples: string[] = [];

    let mode: 'statement' | 'constraints' | 'ignore' = 'statement';

    for (const line of lines) {
      const statementInline = line.match(/^(?:#+\s*)?(?:description|énoncé|objectif)\s*:\s*(.+)$/i);
      if (statementInline) {
        mode = 'statement';
        statementLines.push(statementInline[1].trim());
        continue;
      }

      const constraintsInline = line.match(/^(?:#+\s*)?(?:contraintes?|requirements?|r[eè]gles?)\s*:\s*(.+)$/i);
      if (constraintsInline) {
        mode = 'constraints';
        constraints.push(constraintsInline[1].replace(/^[-•*]\s*/, '').trim());
        continue;
      }

      if (/^(?:#+\s*)?(?:hints?|indices?|astuces?)\s*:\s*(.+)$/i.test(line)) {
        mode = 'ignore';
        continue;
      }

      const exampleInline = line.match(/^(?:#+\s*)?(?:exemple|example|i\/o|entrée\/sortie)\s*:\s*(.+)$/i);
      if (exampleInline) {
        examples.push(exampleInline[1].trim());
        continue;
      }

      if (/^(#+\s*)?(description|énoncé|objectif)\s*:?$/i.test(line)) {
        mode = 'statement';
        continue;
      }
      if (/^(#+\s*)?(contraintes?|requirements?|r[eè]gles?)\s*:?$/i.test(line)) {
        mode = 'constraints';
        continue;
      }
      if (/^(#+\s*)?(hints?|indices?|astuces?)\s*:?$/i.test(line)) {
        mode = 'ignore';
        continue;
      }

      if (mode === 'constraints') {
        constraints.push(line.replace(/^[-•*]\s*/, '').trim());
        continue;
      }

      if (mode === 'ignore') continue;

      statementLines.push(line);
    }

    return {
      statement: statementLines.join('\n').trim() || text,
      constraints,
      example: examples.join('\n').trim(),
    };
  }, [challenge]);

  async function generateMiniChallenge() {
    setIsGeneratingChallenge(true);
    setChallengeFeedback('');
    setCurrentExerciseId('');
    setAttemptCount(0);
    setAttemptHistory([]);
    setChallengeCompleted(false);
    hasTrackedCompletionRef.current = false;

    await trackEvent({
      action: 'mini_challenge_generated',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: { courseSlug, courseTitle },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
        level: levelToQuiz(courseLevel),
        language: 'Python',
        challenge_topic: courseTitle,
        course_description: courseDescription,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          responseLanguage: 'русский простой',
          progressPercent,
          aiTone: 'Coach challengeant bienveillant',
          pedagogicalStyle: 'Challenge contextualisé au cours avec format coding challenge',
          targetAudience: formationName,
          courseTitle,
          courseDescription,
          passThreshold: 70,
          weeklyGoalHours: 5,
        },
      });

      setChallenge(res.data.challenge ?? '');
      setChallengeTests(
        res.data.challenge_tests && typeof res.data.challenge_tests === 'object'
          ? (res.data.challenge_tests as ChallengeTests)
          : null
      );
      const nextTests = res.data.challenge_tests && typeof res.data.challenge_tests === 'object'
        ? (res.data.challenge_tests as ChallengeTests)
        : null;
      const nextChallenge = String(res.data.challenge ?? '');
      const exerciseId = buildExerciseId(nextChallenge, nextTests);
      setCurrentExerciseId(exerciseId);
      loadExerciseProgress(exerciseId);
      exerciseStartedAtRef.current = Date.now();
      lastTabOpenAtRef.current = Date.now();
      hasTrackedFirstEditRef.current = false;
      lastTrackedCodeRef.current = '';

      await trackEvent({
        action: 'challenge_viewed',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: {
          courseSlug,
          courseTitle,
          exerciseId,
          level: courseLevel,
          progressPercent,
          formationName,
        },
      });
      const rawStarterCode = String(
        res.data.starter_code
        ?? res.data.challenge_json?.starter_code
        ?? ''
      ).trim();

      if (rawStarterCode) {
        setChallengeCode(rawStarterCode);
      } else {
        const fnName = nextTests?.function_name?.trim();
        if (fnName) {
          const firstCase = nextTests?.test_cases?.[0];
          const argsHint = firstCase?.args_literal
            ? firstCase.args_literal.replace(/^\[|\]$/g, '').trim()
            : '';
          const paramList = argsHint
            ? argsHint.split(',').map((_, i) => `arg${i + 1}`).join(', ')
            : 'args';
          setChallengeCode(`def ${fnName}(${paramList}):\n    # Напиши свой код здесь\n    pass\n`);
        } else {
          setChallengeCode('# Напиши свой Python-код здесь\n\n');
        }
      }
      setInstructionPage(0);

      await trackEvent({
        action: 'mini_challenge_generated',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: { courseSlug },
      });
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      setChallenge(detail ? `Не удалось сгенерировать задание. (${detail})` : 'Не удалось сгенерировать задание.');
      await trackEvent({
        action: 'mini_challenge_generated',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: { courseSlug },
      });
    } finally {
      setIsGeneratingChallenge(false);
    }
  }

  async function submitMiniChallenge() {
    if (!challenge.trim() || !challengeCode.trim()) return;

    setInstructionPage(testsTabIndex >= 0 ? testsTabIndex : 0);
    setTestsTabHighlight(true);
    setIsSubmittingChallenge(true);
    await trackEvent({
      action: 'mini_challenge_submitted',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: {
        courseSlug,
        exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        codeLength: challengeCode.length,
        attemptIndex: attemptCount + 1,
        timeOnTaskSec: Math.max(1, Math.round((Date.now() - exerciseStartedAtRef.current) / 1000)),
      },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: challenge,
        student_code: challengeCode,
        challenge_tests: challengeTests,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          responseLanguage: 'русский простой',
          progressPercent,
          aiTone: 'Évaluateur pédagogique précis',
          pedagogicalStyle: 'Correction explicative orientée progression',
          targetAudience: formationName,
          passThreshold: 70,
          weeklyGoalHours: 5,
        },
      });

      const effectiveExerciseId = currentExerciseId || buildExerciseId(challenge, challengeTests);
      if (!currentExerciseId) {
        setCurrentExerciseId(effectiveExerciseId);
      }
      const { completedKey, attemptsKey, historyKey } = getExerciseStorageKeys(courseSlug, effectiveExerciseId);

      const noteRaw = String(res.data?.evaluation_json?.note ?? '');
      const noteMatch = noteRaw.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
      const noteCandidate = noteMatch ? Number(noteMatch[1].replace(',', '.')) : null;

      const nextAttempts = attemptCount + 1;
      setAttemptCount(nextAttempts);
      window.localStorage.setItem(attemptsKey, String(nextAttempts));

      const solvedNow = noteCandidate !== null && noteCandidate >= 7;
      setChallengeCompleted(solvedNow);

      if (solvedNow) {
        window.localStorage.setItem(completedKey, 'true');
        if (!hasTrackedCompletionRef.current) {
          hasTrackedCompletionRef.current = true;
          await trackEvent({
            action: 'exercise_completed',
            feature: 'course_mini_challenge_page',
            status: 'success',
            metadata: {
              courseSlug,
              exerciseId: effectiveExerciseId,
              attemptCount: nextAttempts,
              note: noteRaw || 'N/A',
              testsPassed: res.data?.evaluation_json?.test_summary?.passed ?? null,
              testsTotal: res.data?.evaluation_json?.test_summary?.total ?? null,
              timeOnTaskSec: Math.max(1, Math.round((Date.now() - exerciseStartedAtRef.current) / 1000)),
            },
          });
        }
      } else {
        window.localStorage.setItem(completedKey, 'false');
      }

      const nextEntry: AttemptItem = {
        at: new Date().toISOString(),
        status: solvedNow ? 'validated' : 'failed',
        note: noteRaw || 'N/A',
      };

      const nextHistory = [nextEntry, ...attemptHistory].slice(0, 6);
      setAttemptHistory(nextHistory);
      window.localStorage.setItem(historyKey, JSON.stringify(nextHistory));

      if (res.data?.evaluation_json && typeof res.data.evaluation_json === 'object') {
        setChallengeFeedback(JSON.stringify(res.data.evaluation_json));
      } else {
        setChallengeFeedback(res.data.evaluation ?? '');
      }

      try {
        await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'challenge',
            actorClerkId: userId ?? undefined,
            courseSlug,
            courseTitle,
            challengeText: challenge,
            submittedCode: challengeCode,
            evaluation: res.data.evaluation_json ?? { evaluation: res.data.evaluation ?? '' },
            status: 'success',
          }),
        });
      } catch {
        // keep silent: persistence must not block UX
      }

      await trackEvent({
        action: 'mini_challenge_submitted',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: {
          courseSlug,
          exerciseId: effectiveExerciseId,
          codeLength: challengeCode.length,
          attemptIndex: nextAttempts,
          note: noteRaw || 'N/A',
          solvedNow,
          testsPassed: res.data?.evaluation_json?.test_summary?.passed ?? null,
          testsTotal: res.data?.evaluation_json?.test_summary?.total ?? null,
          timeOnTaskSec: Math.max(1, Math.round((Date.now() - exerciseStartedAtRef.current) / 1000)),
        },
      });
    } catch {
      setChallengeFeedback('Ошибка ИИ-проверки.');
      await trackEvent({
        action: 'mini_challenge_submitted',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          codeLength: challengeCode.length,
          attemptIndex: attemptCount + 1,
          timeOnTaskSec: Math.max(1, Math.round((Date.now() - exerciseStartedAtRef.current) / 1000)),
        },
      });
    } finally {
      setIsSubmittingChallenge(false);
      window.setTimeout(() => setTestsTabHighlight(false), 1200);
    }
  }

  async function resolveChallenge() {
    if (!challengeCode.trim()) return;

    setIsResolving(true);
    await trackEvent({
      action: 'challenge_resolved_clicked',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: {
        courseSlug,
        exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        attemptCount,
        codeLength: challengeCode.length,
      },
    });
    try {
      const response = await axios.post(`${apiBaseUrl}/resolve-challenge/`, {
        code: challengeCode,
        challenge_description: challenge,
        challenge_tests: challengeTests,
        max_iterations: 3,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          responseLanguage: 'русский простой',
          pedagogicalStyle: 'Correction avec explication simple et pédagogique',
          aiTone: 'Tuteur clair et pratique',
          targetAudience: formationName,
        },
      });

      const correctedCode = String(response.data?.corrected_code ?? '').trim();
      const explanation = String(response.data?.explanation ?? '').trim();

      if (!correctedCode) {
        setDebugResponse('Решение временно недоступно.');
        return;
      }

      const summary = response.data?.test_summary;
      const results = Array.isArray(response.data?.test_results) ? response.data.test_results : [];
      if (summary) {
        setChallengeFeedback(JSON.stringify({
          evaluation_mode: 'tests',
          test_summary: summary,
          test_results: results,
          commentaire: response.data?.success
            ? 'Исправление сгенерировано и проверено на тестах задания.'
            : 'Исправление сгенерировано, но некоторые тесты ещё не проходят.',
        }));
      }

      const explanationHeader = explanation
        ? [
            '# Направленная корректура',
            ...explanation
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 6)
              .map((line) => `# ${line}`),
            '',
          ].join('\n')
        : '# Направленная корректура\n# Версия от ИИ-наставника.\n\n';

      setChallengeCode(`${explanationHeader}${correctedCode}`);
      setInstructionPage(testsTabIndex >= 0 ? testsTabIndex : 0);
      if (!response.data?.success) {
        setDebugResponse('Предложенное исправление улучшает решение, но пока не проходит все тесты.');
      }

      await trackEvent({
        action: 'challenge_resolved_clicked',
        feature: 'course_mini_challenge_page',
        status: response.data?.success ? 'success' : 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          attemptCount,
          success: Boolean(response.data?.success),
          testsPassed: response.data?.test_summary?.passed ?? null,
          testsTotal: response.data?.test_summary?.total ?? null,
        },
      });
    } catch {
      setDebugResponse('Не удалось сгенерировать решение.');
      await trackEvent({
        action: 'challenge_resolved_clicked',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          attemptCount,
        },
      });
    } finally {
      setIsResolving(false);
    }
  }

  useEffect(() => {
    configureMonacoLoader();
    generateMiniChallenge();
  }, []);

  useEffect(() => {
    const tab = instructionPages[instructionPage];
    const now = Date.now();
    const previousTabDurationSec = Math.max(0, Math.round((now - lastTabOpenAtRef.current) / 1000));
    lastTabOpenAtRef.current = now;

    trackEvent({
      action: 'tab_opened',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: {
        courseSlug,
        exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        tab,
        previousTabDurationSec,
      },
    });
  }, [instructionPage]);

  useEffect(() => {
    if (!challengeCode.trim()) return;
    const timer = window.setTimeout(() => {
      const previousLength = lastTrackedCodeRef.current.length;
      const currentLength = challengeCode.length;
      const deltaChars = currentLength - previousLength;
      const isFirstEdit = !hasTrackedFirstEditRef.current;
      hasTrackedFirstEditRef.current = true;
      lastTrackedCodeRef.current = challengeCode;

      trackEvent({
        action: isFirstEdit ? 'code_first_edit' : 'code_edited',
        feature: 'course_mini_challenge_page',
        status: 'start',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          codeLength: currentLength,
          deltaChars,
          attemptCount,
        },
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [challengeCode, challenge, challengeTests, attemptCount, courseSlug, currentExerciseId]);

  useEffect(() => {
    return () => {
      if (hasTrackedCompletionRef.current || attemptCount === 0) return;
      trackEvent({
        action: 'exercise_abandoned',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          attemptCount,
          timeOnTaskSec: Math.max(1, Math.round((Date.now() - exerciseStartedAtRef.current) / 1000)),
        },
      });
    };
  }, [attemptCount, challenge, challengeTests, courseSlug, currentExerciseId]);

  const instructionBody = useMemo(() => {
    if (instructionPages[instructionPage] === 'Отладка') {
      return '';
    }

    if (instructionPages[instructionPage] === 'Задание') {
      const statement = challengeSections.statement.trim();
      const example = challengeSections.example.trim();
      if (!statement && !example) {
        return 'Нажми "Новое задание" для генерации задачи.';
      }
      if (statement && example) {
        return `${statement}\n\nПример:\n${example}`;
      }
      return statement || `Пример:\n${example}`;
    }

    if (instructionPages[instructionPage] === 'Правила') {
      if (challengeSections.constraints.length > 0) {
        return challengeSections.constraints.map((item, index) => `${index + 1}) ${item}`).join('\n');
      }
      return [
        '1) Пишите только исполняемый Python-код.',
        '2) Соблюдай входы/выходы из задания.',
        '3) Предпочитай ясное и надёжное решение.',
        '4) Обрабатывай граничные случаи из задания.',
      ].join('\n');
    }

    if (instructionPages[instructionPage] === 'Тесты') {
      const testCases = Array.isArray(challengeTests?.test_cases) ? challengeTests.test_cases : [];
      const qualityChecks = Array.isArray(challengeTests?.quality_checks) ? challengeTests.quality_checks : [];

      if (testCases.length === 0 && qualityChecks.length === 0) {
        return 'Тест-кейсы недоступны для данного задания.';
      }

      const testsLines = testCases.slice(0, 8).map((testCase, index) => {
        const name = (testCase?.name || `Кейс ${index + 1}`).toString();
        const expected = testCase?.expected_literal || testCase?.expected_stdout || 'не указано';
        const constraint = testCase?.constraint || 'Неявное условие';
        return `• ${name} -> ожидается: ${expected} (${constraint})`;
      });

      const qualityLines = qualityChecks.slice(0, 4).map((item) => `• ${item}`);

      return [...testsLines, ...(qualityLines.length > 0 ? ['Качество кода:'] : []), ...qualityLines].join('\n');
    }

    return [
      '• Начни с простого примера, затем обобщи.',
      '• Проверь граничные условия перед отправкой.',
      '• Давай переменным и функциям понятные имена.',
      '• Если застрял — сначала сделай минимальную рабочую версию.',
    ].join('\n');
  }, [instructionPage, challengeSections, challengeTests]);

  const instructionLines = useMemo(
    () => instructionBody.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    [instructionBody]
  );

  const structuredDebug = useMemo(() => {
    const raw = debugResponse.trim();
    if (!raw) {
      return {
        status: '',
        detectedError: '',
        advice: '',
        nextAction: '',
      };
    }

    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    let status = '';
    let detectedError = '';
    let advice = '';
    let nextAction = '';

    for (const line of lines) {
      const lower = line.toLowerCase();

      if (lower.startsWith('statut :')) {
        status = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('статус:') || lower.startsWith('статус :')) {
        status = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('erreur détectée :') || lower.startsWith('erreur detectee :') || lower.startsWith('erreur principale :')) {
        detectedError = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('обнаруженная ошибка:') || lower.startsWith('ошибка:') || lower.startsWith('основная ошибка:')) {
        detectedError = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('conseil :') || lower.startsWith('indice :') || lower.startsWith('indice de réflexion :')) {
        advice = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('совет:') || lower.startsWith('подсказка:')) {
        advice = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('prochaine action :') || lower.startsWith('action recommandée :')) {
        nextAction = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('следующее действие:') || lower.startsWith('рекомендуемое действие:')) {
        nextAction = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('следующий шаг:')) {
        nextAction = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }
    }

    if (!detectedError && lines.length > 0) {
      const fallback = lines.find((line) => {
        const lower = line.toLowerCase();
        return !(
          lower.startsWith('statut :')
          || lower.startsWith('статус:')
          || lower.startsWith('статус :')
          || lower.startsWith('conseil :')
          || lower.startsWith('indice :')
          || lower.startsWith('indice de réflexion :')
          || lower.startsWith('совет:')
          || lower.startsWith('подсказка:')
          || lower.startsWith('prochaine action :')
          || lower.startsWith('action recommandée :')
          || lower.startsWith('следующее действие:')
          || lower.startsWith('рекомендуемое действие:')
          || lower.startsWith('следующий шаг:')
        );
      });
      detectedError = fallback || '';
    }

    return {
      status,
      detectedError,
      advice,
      nextAction,
    };
  }, [debugResponse]);

  const formattedStatement = useMemo(() => {
    const objective = challengeSections.statement.trim();
    const example = challengeSections.example.trim();

    let input = '';
    let output = '';

    if (example) {
      const entryOutputMatch = example.match(/Entr[ée]e\s*:\s*(.+?)\s*(?:->|→)\s*Sortie\s*:\s*(.+)$/i);
      if (entryOutputMatch) {
        input = entryOutputMatch[1].trim();
        output = entryOutputMatch[2].trim();
      } else {
        const inputMatch = example.match(/Entr[ée]e\s*:\s*(.+)$/i);
        const outputMatch = example.match(/Sortie\s*:\s*(.+)$/i);
        input = inputMatch?.[1]?.trim() ?? '';
        output = outputMatch?.[1]?.trim() ?? '';
      }
    }

    return { objective, example, input, output };
  }, [challengeSections.example, challengeSections.statement]);

  async function runInlineDebugger() {
    if (!challengeCode.trim()) {
      setDebugResponse('Сначала добавь код в редактор, затем запусти анализ.');
      return;
    }

    await trackEvent({
      action: 'debug_started',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: {
        courseSlug,
        exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        step: 0,
      },
    });

    setDebugLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code: challengeCode,
        challenge_description: challenge,
        level: levelToQuiz(courseLevel),
        step: 0,
        student_answer: '',
        session_id: null,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          responseLanguage: 'русский простой',
          pedagogicalStyle: 'Debug guidé socratique centré mini-challenge',
          aiTone: 'Coach concis et actionnable',
          progressPercent,
          targetAudience: formationName,
        },
      });
      setDebugSessionId(res.data.session_id ?? null);
      setDebugStep(Number(res.data.step ?? 1));
      setDebugResponse(String(res.data.response ?? '')); 
      setDebugAnswer('');

      await trackEvent({
        action: 'debug_started',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          sessionId: res.data.session_id ?? null,
          step: Number(res.data.step ?? 1),
        },
      });
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail || 'Ошибка направленной отладки.'
        : 'Ошибка направленной отладки.';
      setDebugResponse(String(message));

      await trackEvent({
        action: 'debug_started',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        },
      });
    } finally {
      setDebugLoading(false);
    }
  }

  async function sendInlineDebuggerReply() {
    if (!debugSessionId || !debugAnswer.trim()) return;

    await trackEvent({
      action: 'debug_replied',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: {
        courseSlug,
        exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
        step: debugStep + 1,
      },
    });

    setDebugLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code: challengeCode,
        challenge_description: challenge,
        level: levelToQuiz(courseLevel),
        step: debugStep + 1,
        student_answer: debugAnswer,
        session_id: debugSessionId,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          responseLanguage: 'русский простой',
          pedagogicalStyle: 'Debug guidé socratique centré mini-challenge',
          aiTone: 'Coach concis et actionnable',
          progressPercent,
          targetAudience: formationName,
        },
      });
      setDebugSessionId(res.data.session_id ?? debugSessionId);
      setDebugStep(Number(res.data.step ?? debugStep + 1));
      setDebugResponse(String(res.data.response ?? ''));
      setDebugAnswer('');

      await trackEvent({
        action: 'debug_replied',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          step: Number(res.data.step ?? debugStep + 1),
        },
      });
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail || 'Не удалось отправить ответ на отладку.'
        : 'Не удалось отправить ответ на отладку.';
      setDebugResponse(String(message));

      await trackEvent({
        action: 'debug_replied',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: {
          courseSlug,
          exerciseId: currentExerciseId || buildExerciseId(challenge, challengeTests),
          step: debugStep + 1,
        },
      });
    } finally {
      setDebugLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FBFBF9]">

      {/* ── HEADER ── */}
      <div className="shrink-0 border-b-2 border-[#1C293C] bg-[#FBFBF9] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <Link
          href={`/courses/${courseSlug}`}
          className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Назад к курсу
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Мини-задание</p>
          <h1 className="font-black text-sm text-[#1C293C] mt-0.5">{courseTitle}</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{courseLevel}</span>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{progressPercent}%</span>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{formationName}</span>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="flex flex-1 min-h-0 flex-col xl:flex-row gap-2 p-2 overflow-hidden">

        {/* ── LEFT: INSTRUCTION PANEL ── */}
        <aside className="w-full xl:w-[420px] shrink-0 flex flex-col border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] overflow-hidden">

          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1.5 flex-wrap p-2 border-b-2 border-[#1C293C]/20">
            {instructionPages.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setInstructionPage(index)}
                className={`border-2 px-2.5 py-1 text-xs font-black transition-all duration-100 ${
                  instructionPage === index
                    ? 'border-[#1C293C] bg-[#FDC800] text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]'
                    : 'border-[#1C293C]/30 text-[#1C293C]/60 hover:border-[#1C293C] hover:text-[#1C293C]'
                } ${label === 'Тесты' && (isSubmittingChallenge || testsTabHighlight) ? 'animate-pulse' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-white p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50 mb-2">
              Страница {instructionPage + 1}/{instructionPages.length}
            </p>
            <div>
              {instructionPages[instructionPage] === 'Отладка' ? (
                <div className="space-y-3 text-sm">
                  {/* Header with button */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1C293C]/10">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">ИИ-отладчик</p>
                      <p className="text-[11px] text-[#1C293C]/60 mt-0.5">Анализ направленный</p>
                    </div>
                    <button
                      type="button"
                      onClick={runInlineDebugger}
                      disabled={debugLoading || !challengeCode.trim()}
                      className="border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {debugLoading ? 'Анализ...' : 'Запустить'}
                    </button>
                  </div>

                  {/* Response content */}
                  {!debugResponse ? (
                    <div className="text-[11px] text-[#1C293C]/50 italic py-4 text-center">
                      Кликни {`"Запустить"`} чтобы начать анализ кода
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Error box - minimal style */}
                      <div className="border-l-4 border-[#DC2626] pl-3">
                        <p className="text-[10px] uppercase tracking-widest font-black text-[#DC2626] inline-flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Ошибка
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#1C293C] font-medium">
                          {structuredDebug.detectedError || 'Нет конкретной ошибки.'}
                        </p>
                      </div>

                      {/* Advice box - minimal style */}
                      {structuredDebug.advice && (
                        <div className="border-l-4 border-[#D97706] pl-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-[#D97706] inline-flex items-center gap-1">
                            <Lightbulb className="h-3.5 w-3.5" /> Подсказка
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#1C293C] font-medium">{structuredDebug.advice}</p>
                        </div>
                      )}

                      {/* Next action box - minimal style */}
                      {structuredDebug.nextAction && (
                        <div className="border-l-4 border-[#432DD7] pl-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1">
                            <PlayCircle className="h-3.5 w-3.5" /> Действие
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#1C293C] font-medium">{structuredDebug.nextAction}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input section - modern style */}
                  <div className="pt-2 border-t border-[#1C293C]/10 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">Задай вопрос</p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={debugAnswer}
                        onChange={(e) => setDebugAnswer(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !debugLoading && debugSessionId && debugAnswer.trim() && sendInlineDebuggerReply()}
                        placeholder="Твой вопрос..."
                        className="min-w-0 flex-1 border border-[#1C293C]/20 bg-white px-2.5 py-2 text-xs text-[#1C293C] placeholder:text-[#1C293C]/40 focus:outline-none focus:border-[#432DD7] focus:ring-1 focus:ring-[#432DD7]/30 rounded-sm transition-colors"
                      />
                      <button
                        type="button"
                        onClick={sendInlineDebuggerReply}
                        disabled={debugLoading || !debugSessionId || !debugAnswer.trim()}
                        className="shrink-0 whitespace-nowrap border-2 border-[#1C293C] bg-[#432DD7] px-3 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              ) : instructionPages[instructionPage] === 'Задание' ? (
                <div className="space-y-1.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Цель</p>
                    <p className="text-[12px] leading-relaxed text-[#1C293C]">
                      {formattedStatement.objective || 'Нажми "Новое задание" для генерации задачи.'}
                    </p>
                  </div>

                  {(formattedStatement.input || formattedStatement.output || formattedStatement.example) && (
                    <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Пример</p>
                      {formattedStatement.input && (
                        <div className="border border-[#1C293C]/20 bg-white px-2 py-1.5">
                          <p className="text-[10px] text-[#1C293C]/50 mb-0.5">Вход</p>
                          <pre className="text-[11px] whitespace-pre-wrap text-[#1C293C]">{formattedStatement.input}</pre>
                        </div>
                      )}
                      {formattedStatement.output && (
                        <div className="border border-[#1C293C]/20 bg-white px-2 py-1.5">
                          <p className="text-[10px] text-[#1C293C]/50 mb-0.5">Ожидаемый выход</p>
                          <pre className="text-[11px] whitespace-pre-wrap text-[#1C293C]">{formattedStatement.output}</pre>
                        </div>
                      )}
                      {!formattedStatement.input && !formattedStatement.output && formattedStatement.example && (
                        <pre className="text-[11px] whitespace-pre-wrap border border-[#1C293C]/20 bg-white px-2 py-1.5 text-[#1C293C]">{formattedStatement.example}</pre>
                      )}
                    </div>
                  )}
                </div>
              ) : instructionPages[instructionPage] === 'Правила' ? (
                <div className="space-y-1.5 text-sm">
                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Правила</p>
                      <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">
                        {challengeSections.constraints.length > 0 ? challengeSections.constraints.length : 4} правил
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {(challengeSections.constraints.length > 0
                        ? challengeSections.constraints
                        : [
                            'Пишите только исполняемый Python-код.',
                            'Соблюдай входы/выходы из задания.',
                            'Предпочитай ясное и надёжное решение.',
                            'Обрабатывай граничные случаи из задания.',
                          ]
                      ).map((item, index) => (
                        <div key={`${item}-${index}`} className="border border-[#1C293C]/20 bg-white px-2 py-1.5">
                          <p className="text-[11px] leading-relaxed text-[#1C293C]">{index + 1}. {item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : instructionPages[instructionPage] === 'Тесты' ? (
                <div className="space-y-1.5 text-sm">
                  {(isSubmittingChallenge || testsTabHighlight) && (
                    <div className="border-2 border-[#FDC800] bg-[#FDC800]/20 px-2 py-1.5 animate-pulse">
                      <p className="text-[11px] uppercase tracking-widest font-black text-[#1C293C]">Проверка...</p>
                    </div>
                  )}

                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Тест-кейсы</p>
                      {Array.isArray(challengeTests?.test_cases) && challengeTests.test_cases.length > 0 && (
                        <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">
                          {challengeTests.test_cases.length} тестов
                        </span>
                      )}
                    </div>
                    {Array.isArray(challengeTests?.test_cases) && challengeTests.test_cases.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1">
                        {challengeTests.test_cases.slice(0, 8).map((testCase, index) => (
                          <div key={`${testCase?.name || 'test'}-${index}`} className="border border-[#1C293C]/20 bg-white px-2 py-1.5 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-black text-[#1C293C]/70 truncate">{testCase?.name || `test_${index + 1}`}</p>
                              <span className="border border-[#1C293C]/20 px-1.5 py-0.5 text-[10px] text-[#1C293C]/60">#{index + 1}</span>
                            </div>
                            {testCase?.args_literal && testCase?.expected_literal && (
                              <pre className="text-[10px] font-mono bg-[#1e1e1e] text-[#a8ff78] px-2 py-1 overflow-x-auto rounded-none">
                                {`assert ${challengeTests?.function_name || 'solution'}(${testCase.args_literal.replace(/^\[|\]$/g, '')}) == ${testCase.expected_literal}`}
                              </pre>
                            )}
                            {testCase?.stdin_lines && testCase?.expected_stdout && (
                              <p className="text-[10px] text-[#1C293C]/50 truncate">
                                input: {JSON.stringify(testCase.stdin_lines)} → {testCase.expected_stdout}
                              </p>
                            )}
                            {testCase?.constraint && (
                              <p className="text-[10px] text-[#1C293C]/40 italic truncate">{testCase.constraint}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#1C293C]/60">Тест-кейсы ещё не сгенерированы.</p>
                    )}
                  </div>

                  <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Результаты</p>
                    {parsedChallengeFeedback.testSummary ? (
                      <div
                        className={`border-2 px-2 py-1.5 text-[11px] font-black ${
                          parsedChallengeFeedback.testSummary.passed === parsedChallengeFeedback.testSummary.total && parsedChallengeFeedback.testSummary.total > 0
                            ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                            : 'border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626]'
                        }`}
                      >
                        {parsedChallengeFeedback.testSummary.passed}/{parsedChallengeFeedback.testSummary.total} прошло
                        {parsedChallengeFeedback.testSummary.runtime_error ? ` · ${parsedChallengeFeedback.testSummary.runtime_error}` : ''}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#1C293C]/60">Отправь код для просмотра результатов.</p>
                    )}

                    {parsedChallengeFeedback.testResults.length > 0 && (
                      <div className="grid grid-cols-1 gap-1">
                        {parsedChallengeFeedback.testResults.slice(0, 8).map((item, index) => (
                          <div
                            key={`${item.name}-${index}`}
                            className={`border-2 px-2 py-1.5 ${
                              item.status === 'passed'
                                ? 'border-[#16A34A] bg-[#16A34A]/10'
                                : 'border-[#DC2626] bg-[#DC2626]/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[11px] font-black truncate ${item.status === 'passed' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                {item.name}
                              </p>
                              <span className={`border px-1.5 py-0.5 text-[10px] font-black ${item.status === 'passed' ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#DC2626] text-[#DC2626]'}`}>
                                {item.status === 'passed' ? 'ok' : 'ko'}
                              </span>
                            </div>
                            <p className={`mt-0.5 text-[10px] truncate ${item.status === 'passed' ? 'text-[#16A34A]/80' : 'text-[#DC2626]/80'}`}>Ожидается: {item.expected}</p>
                            <p className={`text-[10px] truncate ${item.status === 'passed' ? 'text-[#16A34A]/80' : 'text-[#DC2626]/80'}`}>Получено: {item.actual}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <ul className="space-y-1.5 text-sm leading-relaxed text-[#1C293C]">
                  {instructionLines.map((line, index) => (
                    <li key={`${line}-${index}`} className={line.startsWith('•') ? 'ml-2' : ''}>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="shrink-0 border-t-2 border-[#1C293C]/20 p-2 flex items-center justify-between gap-2">
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

        {/* ── RIGHT: CODE EDITOR PANEL ── */}
        <div className="flex-1 min-h-0 flex flex-col border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b-2 border-[#1C293C]/20">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Зона кода Python
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitMiniChallenge}
                disabled={isSubmittingChallenge || !challenge.trim() || !challengeCode.trim()}
                className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmittingChallenge ? 'Проверяю...' : 'Отправить решение'}
              </button>
              {canResolve && (
                <button
                  type="button"
                  onClick={resolveChallenge}
                  disabled={isResolving}
                  className="border-2 border-[#1C293C] bg-white px-4 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
                >
                  {isResolving ? 'Решаю...' : 'Решить'}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 border-b-2 border-[#1C293C]/20 overflow-hidden">
            <Editor
              key={currentExerciseId || 'default'}
              height="100%"
              defaultLanguage="python"
              value={challengeCode}
              onChange={(value) => setChallengeCode(value || '')}
              loading={
                <div className="flex items-center justify-center h-[380px] bg-[#1e1e1e]">
                  <p className="text-xs text-white/40">Загрузка редактора…</p>
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                lineNumbersMinChars: 3,
              }}
            />
          </div>

          {/* Bottom: feedback + history */}
          <div className="shrink-0 max-h-44 overflow-y-auto border-t-2 border-[#1C293C]/20 p-2 space-y-2">

          {!parsedChallengeFeedback.comment
            && parsedChallengeFeedback.consignes.length === 0
            && parsedChallengeFeedback.idees.length === 0
            && parsedChallengeFeedback.nextSteps.length === 0
            && parsedChallengeFeedback.raw && (
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed border-2 border-[#1C293C] bg-white p-2 text-[#1C293C]">
              {parsedChallengeFeedback.raw}
            </pre>
          )}

          {/* Attempt history */}
          <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Попытки</p>
              <span className="border border-[#1C293C] px-2 py-0.5 text-xs font-black text-[#1C293C]">{attemptCount}</span>
            </div>
            {attemptHistory.length > 0 ? (
              <ul className="space-y-1.5">
                {attemptHistory.map((item, index) => (
                  <li
                    key={`${item.at}-${index}`}
                    className={`border-2 px-2.5 py-2 text-xs font-semibold ${
                      item.status === 'validated'
                        ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                        : 'border-[#DC2626]/40 bg-[#DC2626]/5 text-[#DC2626]'
                    }`}
                  >
                    Попытка #{attemptHistory.length - index} · {item.note} · {item.status === 'validated' ? 'пройдена' : 'не пройдена'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#1C293C]/60">Попыток пока нет.</p>
            )}
          </div>

          </div>{/* end bottom section */}
        </div>

      </div>
    </div>
  );
}
