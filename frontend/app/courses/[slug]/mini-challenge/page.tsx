'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Code2, Lightbulb, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/event-tracker';
import type { ParsedChallengeFeedback } from './_components/types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const instructionPages = ['Énoncé', 'Contraintes', 'Tests', 'Debugger'] as const;

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
  const testsTabIndex = instructionPages.indexOf('Tests');
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
      setChallengeCode(
        String(
          res.data.starter_code
          ?? res.data.challenge_json?.starter_code
          ?? ''
        )
      );
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
      setChallenge(detail ? `Impossible de générer le challenge pour le moment. (${detail})` : 'Impossible de générer le challenge pour le moment.');
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
      setChallengeFeedback('Échec de la correction IA.');
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
          pedagogicalStyle: 'Correction avec explication simple et pédagogique',
          aiTone: 'Tuteur clair et pratique',
          targetAudience: formationName,
        },
      });

      const correctedCode = String(response.data?.corrected_code ?? '').trim();
      const explanation = String(response.data?.explanation ?? '').trim();

      if (!correctedCode) {
        setDebugResponse('Résolution indisponible pour le moment.');
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
            ? 'Correction générée et validée sur les tests du challenge.'
            : 'Correction générée, mais certains tests restent à corriger.',
        }));
      }

      const explanationHeader = explanation
        ? [
            '# Correction guidée',
            ...explanation
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 6)
              .map((line) => `# ${line}`),
            '',
          ].join('\n')
        : '# Correction guidée\n# Version proposée par le tuteur pour débloquer l’exercice.\n\n';

      setChallengeCode(`${explanationHeader}${correctedCode}`);
      setInstructionPage(testsTabIndex >= 0 ? testsTabIndex : 0);
      if (!response.data?.success) {
        setDebugResponse('La correction proposée améliore la solution, mais ne valide pas encore tous les tests.');
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
      setDebugResponse('Impossible de générer une résolution pour le moment.');
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
    generateMiniChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (instructionPages[instructionPage] === 'Debugger') {
      return '';
    }

    if (instructionPages[instructionPage] === 'Énoncé') {
      const statement = challengeSections.statement.trim();
      const example = challengeSections.example.trim();
      if (!statement && !example) {
        return 'Clique sur “Nouveau challenge” pour générer un énoncé.';
      }
      if (statement && example) {
        return `${statement}\n\nExemple:\n${example}`;
      }
      return statement || `Exemple:\n${example}`;
    }

    if (instructionPages[instructionPage] === 'Contraintes') {
      if (challengeSections.constraints.length > 0) {
        return challengeSections.constraints.map((item, index) => `${index + 1}) ${item}`).join('\n');
      }
      return [
        '1) Écris uniquement du code Python exécutable.',
        '2) Respecte les entrées/sorties demandées dans l’énoncé.',
        '3) Favorise une solution claire et robuste.',
        '4) Gère les cas limites mentionnés dans le challenge.',
      ].join('\n');
    }

    if (instructionPages[instructionPage] === 'Tests') {
      const testCases = Array.isArray(challengeTests?.test_cases) ? challengeTests.test_cases : [];
      const qualityChecks = Array.isArray(challengeTests?.quality_checks) ? challengeTests.quality_checks : [];

      if (testCases.length === 0 && qualityChecks.length === 0) {
        return 'Aucun cas de validation disponible pour ce challenge.';
      }

      const testsLines = testCases.slice(0, 8).map((testCase, index) => {
        const name = (testCase?.name || `Cas ${index + 1}`).toString();
        const expected = testCase?.expected_literal || testCase?.expected_stdout || 'attendu non précisé';
        const constraint = testCase?.constraint || 'Contrainte implicite du cas';
        return `• ${name} -> attendu: ${expected} (${constraint})`;
      });

      const qualityLines = qualityChecks.slice(0, 4).map((item) => `• ${item}`);

      return [...testsLines, ...(qualityLines.length > 0 ? ['Qualité du code:'] : []), ...qualityLines].join('\n');
    }

    return [
      '• Commence par un exemple simple puis généralise.',
      '• Vérifie les conditions limites avant de soumettre.',
      '• Nomme clairement tes variables et fonctions.',
      '• Si blocage, fais une version minimale fonctionnelle puis améliore.',
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

      if (lower.startsWith('erreur détectée :') || lower.startsWith('erreur detectee :') || lower.startsWith('erreur principale :')) {
        detectedError = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('conseil :') || lower.startsWith('indice :') || lower.startsWith('indice de réflexion :')) {
        advice = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }

      if (lower.startsWith('prochaine action :') || lower.startsWith('action recommandée :')) {
        nextAction = line.split(':').slice(1).join(':').trim() || line;
        continue;
      }
    }

    if (!detectedError && lines.length > 0) {
      detectedError = lines[0];
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
      setDebugResponse('Ajoute d’abord du code dans l’éditeur, puis lance le debug guidé.');
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
        ? (error.response?.data as { detail?: string } | undefined)?.detail || 'Échec du debug guidé.'
        : 'Échec du debug guidé.';
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
        ? (error.response?.data as { detail?: string } | undefined)?.detail || 'Impossible d’envoyer ta réponse au debug.'
        : 'Impossible d’envoyer ta réponse au debug.';
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
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card px-3 py-2">
        <Link href={`/courses/${courseSlug}`} className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au cours
        </Link>
      </section>

      <section className="rounded-2xl border bg-card p-2">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 min-h-[72vh]">
          <aside className="xl:col-span-4 rounded-xl border bg-background p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs">
              {instructionPages.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setInstructionPage(index)}
                  className={`rounded-md border px-2.5 py-1 ${instructionPage === index ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'} ${label === 'Tests' && (isSubmittingChallenge || testsTabHighlight) ? 'animate-pulse border-primary/60' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-2 min-h-[280px]">
              <p className="text-[11px] text-muted-foreground">Page {instructionPage + 1}/{instructionPages.length}</p>
              <div className="max-h-[52vh] overflow-y-auto pr-1">
                {instructionPages[instructionPage] === 'Debugger' ? (
                  <div className="space-y-2 text-sm">
                    <div className="rounded-md border bg-background px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Debugger</p>
                        {structuredDebug.status && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${structuredDebug.status.toLowerCase().includes('pas d') ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted-foreground'}`}>
                            {structuredDebug.status}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">Analyse guidée du code courant</p>
                        <Button variant="outline" className="h-7 text-xs" onClick={runInlineDebugger} disabled={debugLoading || !challengeCode.trim()}>
                          {debugLoading ? 'Analyse...' : 'Analyser'}
                        </Button>
                      </div>
                    </div>

                    {!debugResponse ? (
                      <div className="rounded-md border bg-muted/30 px-2.5 py-2">
                        <p className="text-[11px] text-muted-foreground">Lance une analyse pour afficher l’erreur principale et la prochaine action.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="rounded-sm border bg-background px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Erreur détectée
                          </p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
                            {structuredDebug.detectedError || 'Aucune erreur précise détectée.'}
                          </p>
                        </div>

                        {structuredDebug.advice && (
                          <div className="rounded-sm border bg-background px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Conseil
                            </p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{structuredDebug.advice}</p>
                          </div>
                        )}

                        {structuredDebug.nextAction && (
                          <div className="rounded-sm border bg-background px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                              <PlayCircle className="h-3 w-3" /> Prochaine action
                            </p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{structuredDebug.nextAction}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-md border bg-background p-1.5">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={debugAnswer}
                          onChange={(e) => setDebugAnswer(e.target.value)}
                          placeholder="Pose une question ciblée sur ton bug..."
                          className="w-full rounded-sm border bg-background px-2 py-1.5 text-xs"
                        />
                        <Button
                          variant="secondary"
                          className="h-8 text-xs"
                          onClick={sendInlineDebuggerReply}
                          disabled={debugLoading || !debugSessionId || !debugAnswer.trim()}
                        >
                          Envoyer
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : instructionPages[instructionPage] === 'Énoncé' ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="rounded-md border bg-background p-2 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Objectif</p>
                      <p className="text-[12px] leading-relaxed text-foreground">
                        {formattedStatement.objective || 'Clique sur “Nouveau challenge” pour générer un énoncé.'}
                      </p>
                    </div>

                    {(formattedStatement.input || formattedStatement.output || formattedStatement.example) && (
                      <div className="rounded-md border bg-background p-2 space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exemple</p>
                        {formattedStatement.input && (
                          <div className="rounded-sm border bg-card px-2 py-1.5">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Entrée</p>
                            <pre className="text-[11px] whitespace-pre-wrap">{formattedStatement.input}</pre>
                          </div>
                        )}
                        {formattedStatement.output && (
                          <div className="rounded-sm border bg-card px-2 py-1.5">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Sortie attendue</p>
                            <pre className="text-[11px] whitespace-pre-wrap">{formattedStatement.output}</pre>
                          </div>
                        )}
                        {!formattedStatement.input && !formattedStatement.output && formattedStatement.example && (
                          <pre className="text-[11px] whitespace-pre-wrap rounded-sm border bg-card px-2 py-1.5">{formattedStatement.example}</pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : instructionPages[instructionPage] === 'Contraintes' ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="rounded-md border bg-background p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contraintes</p>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {challengeSections.constraints.length > 0 ? challengeSections.constraints.length : 4} règles
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1">
                        {(challengeSections.constraints.length > 0
                          ? challengeSections.constraints
                          : [
                              'Écris uniquement du code Python exécutable.',
                              'Respecte les entrées/sorties demandées dans l’énoncé.',
                              'Favorise une solution claire et robuste.',
                              'Gère les cas limites mentionnés dans le challenge.',
                            ]
                        ).map((item, index) => (
                          <div key={`${item}-${index}`} className="rounded-sm border bg-card px-2 py-1.5">
                            <p className="text-[11px] leading-relaxed text-foreground">{index + 1}. {item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : instructionPages[instructionPage] === 'Tests' ? (
                  <div className="space-y-1.5 text-sm">
                    {(isSubmittingChallenge || testsTabHighlight) && (
                      <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 animate-pulse">
                        <p className="text-[11px] uppercase tracking-wide text-primary font-semibold">Validation en cours…</p>
                      </div>
                    )}

                    <div className="rounded-md border bg-background p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cas de validation</p>
                        {Array.isArray(challengeTests?.test_cases) && challengeTests.test_cases.length > 0 && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {challengeTests.test_cases.length} cas
                          </span>
                        )}
                      </div>
                      {Array.isArray(challengeTests?.test_cases) && challengeTests.test_cases.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1">
                          {challengeTests.test_cases.slice(0, 8).map((testCase, index) => (
                            <div key={`${testCase?.name || 'test'}-${index}`} className="rounded-sm border bg-card px-2 py-1.5 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold truncate">{testCase?.name || `Cas ${index + 1}`}</p>
                                <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">#{index + 1}</span>
                              </div>
                              {(testCase?.args_literal || testCase?.stdin_lines) && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Entrée: {testCase?.args_literal || JSON.stringify(testCase?.stdin_lines || [])}
                                </p>
                              )}
                              {(testCase?.expected_literal || testCase?.expected_stdout) && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Attendu: {testCase?.expected_literal || testCase?.expected_stdout}
                                </p>
                              )}
                              {testCase?.constraint && (
                                <p className="text-[10px] text-muted-foreground truncate">Contrainte: {testCase.constraint}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucun cas généré pour le moment.</p>
                      )}
                    </div>

                    <div className="rounded-md border bg-background p-2 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Résultats</p>
                      {parsedChallengeFeedback.testSummary ? (
                        <div
                          className={`rounded-sm border px-2 py-1.5 text-[11px] font-medium ${
                            parsedChallengeFeedback.testSummary.passed === parsedChallengeFeedback.testSummary.total && parsedChallengeFeedback.testSummary.total > 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-rose-300 bg-rose-50 text-rose-800'
                          }`}
                        >
                          {parsedChallengeFeedback.testSummary.passed}/{parsedChallengeFeedback.testSummary.total} validés
                          {parsedChallengeFeedback.testSummary.runtime_error ? ` · ${parsedChallengeFeedback.testSummary.runtime_error}` : ''}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Soumets ton code pour voir les résultats.</p>
                      )}

                      {parsedChallengeFeedback.testResults.length > 0 && (
                        <div className="grid grid-cols-1 gap-1">
                          {parsedChallengeFeedback.testResults.slice(0, 8).map((item, index) => (
                            <div
                              key={`${item.name}-${index}`}
                              className={`rounded-sm border px-2 py-1.5 ${
                                item.status === 'passed'
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : 'border-rose-300 bg-rose-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-[11px] font-semibold truncate ${item.status === 'passed' ? 'text-emerald-800' : 'text-rose-800'}`}>
                                  {item.name}
                                </p>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${item.status === 'passed' ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800'}`}>
                                  {item.status === 'passed' ? 'ok' : 'ko'}
                                </span>
                              </div>
                              <p className={`mt-0.5 text-[10px] truncate ${item.status === 'passed' ? 'text-emerald-700' : 'text-rose-700'}`}>Attendu: {item.expected}</p>
                              <p className={`text-[10px] truncate ${item.status === 'passed' ? 'text-emerald-700' : 'text-rose-700'}`}>Obtenu: {item.actual}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
                    {instructionLines.map((line, index) => (
                      <li key={`${line}-${index}`} className={line.startsWith('•') ? 'ml-2 list-disc' : ''}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="h-8 text-xs"
                disabled={instructionPage === 0}
                onClick={() => setInstructionPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Précédent
              </Button>
              <Button
                variant="outline"
                className="h-8 text-xs"
                disabled={instructionPage === instructionPages.length - 1}
                onClick={() => setInstructionPage((value) => Math.min(instructionPages.length - 1, value + 1))}
              >
                Suivant <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </aside>

          <div className="xl:col-span-8 rounded-xl border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Zone de code Python
              </p>
              <div className="flex items-center gap-2">
                <Button className="h-8 text-xs" onClick={submitMiniChallenge} disabled={isSubmittingChallenge || !challenge.trim() || !challengeCode.trim()}>
                  {isSubmittingChallenge ? 'Correction...' : 'Soumettre la solution'}
                </Button>
                {canResolve && (
                  <Button variant="outline" className="h-8 text-xs" onClick={resolveChallenge} disabled={isResolving}>
                    {isResolving ? 'Résolution...' : 'Résoudre'}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Editor
                height="380px"
                defaultLanguage="python"
                value={challengeCode}
                onChange={(value) => setChallengeCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  lineNumbersMinChars: 3,
                }}
              />
            </div>

            {!parsedChallengeFeedback.comment
              && parsedChallengeFeedback.consignes.length === 0
              && parsedChallengeFeedback.idees.length === 0
              && parsedChallengeFeedback.nextSteps.length === 0
              && parsedChallengeFeedback.raw && (
              <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
                {parsedChallengeFeedback.raw}
              </pre>
            )}

            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tentatives effectuées</p>
                <span className="text-xs rounded-md border px-2 py-1">{attemptCount}</span>
              </div>
              {attemptHistory.length > 0 ? (
                <ul className="space-y-1.5">
                  {attemptHistory.map((item, index) => (
                    <li key={`${item.at}-${index}`} className={`rounded-md border px-2.5 py-2 text-xs ${item.status === 'validated' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
                      Tentative #{attemptHistory.length - index} · {item.note} · {item.status === 'validated' ? 'réussie' : 'non validée'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune tentative enregistrée.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
