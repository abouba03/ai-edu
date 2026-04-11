'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ChallengeAttemptRow, ChallengeItem } from '../_components/types';
import { CodeChallengeSidebar } from './_components/code-challenge-sidebar';
import { CodeChallengeEditorPanel } from './_components/code-challenge-editor-panel';
import { TheoryChallengePanel } from './_components/theory-challenge-panel';

type SubmitResult = {
  score: number;
  passed: boolean;
  evaluation: string;
  motivationalMessage?: string | null;
  evaluationJson?: {
    motivational_message?: string;
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
  } | null;
};

const CODE_TESTS_TAB_INDEX = 2;
const CODE_DEBUGGER_TAB_INDEX = 4;

function formatElapsed(value: number) {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function ChallengeDetailPage() {
  const params = useParams<{ challengeId: string }>();
  const challengeId = typeof params?.challengeId === 'string' ? params.challengeId : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<ChallengeItem | null>(null);
  const [code, setCode] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [attempts, setAttempts] = useState<ChallengeAttemptRow[]>([]);
  const [codeActiveTabIndex, setCodeActiveTabIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  const challengeSections = useMemo(() => {
    const text = challenge?.description?.trim() || '';
    if (!text) {
      return {
        statement: 'Lis bien les consignes puis propose une solution claire et robuste.',
        constraints: [
          'Respecte strictement le format entrée/sortie demandé.',
          'Écris une solution Python exécutable et lisible.',
          'Gère les cas limites du problème.',
        ],
      };
    }

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const statementLines: string[] = [];
    const constraints: string[] = [];
    let mode: 'statement' | 'constraints' = 'statement';

    for (const line of lines) {
      const constraintsInline = line.match(/^(?:#+\s*)?(?:contraintes?|requirements?|r[eè]gles?)\s*:\s*(.+)$/i);
      if (constraintsInline) {
        mode = 'constraints';
        constraints.push(constraintsInline[1].replace(/^[-•*]\s*/, '').trim());
        continue;
      }

      if (/^(#+\s*)?(?:contraintes?|requirements?|r[eè]gles?)\s*:?$/i.test(line)) {
        mode = 'constraints';
        continue;
      }

      if (mode === 'constraints') {
        constraints.push(line.replace(/^[-•*]\s*/, '').trim());
      } else {
        statementLines.push(line);
      }
    }

    return {
      statement: statementLines.join('\n').trim() || text,
      constraints:
        constraints.length > 0
          ? constraints
          : [
              'Respecte strictement le format entrée/sortie demandé.',
              'Écris une solution Python exécutable et lisible.',
              'Gère les cas limites du problème.',
            ],
    };
  }, [challenge]);

  useEffect(() => {
    if (!challengeId) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/challenges/${challengeId}`, { cache: 'no-store' });
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || 'challenge_load_failed');
        }

        if (!mounted) return;
        const item = data.challenge as ChallengeItem;
        setChallenge(item);
        setAnswers(Array(item.quizQuestions.length).fill(''));
        setCode('');
        setResult(null);
        setCodeActiveTabIndex(0);
        setElapsedSec(0);
        startedAtRef.current = Date.now();
      } catch {
        if (mounted) {
          setChallenge(null);
          setError('Impossible de charger ce challenge.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [challengeId]);

  useEffect(() => {
    if (!challenge?.kind) return;

    const timer = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [challenge?.kind]);

  useEffect(() => {
    if (!challengeId) return;
    let mounted = true;

    async function loadAttempts() {
      try {
        const res = await fetch(`/api/challenges/attempts?challengeId=${challengeId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
      } catch {
        if (mounted) setAttempts([]);
      }
    }

    loadAttempts();
    return () => {
      mounted = false;
    };
  }, [challengeId, result]);

  async function submit() {
    if (!challenge || !challengeId) return;

    if (challenge.kind === 'code' && !code.trim()) {
      setError('Ajoute une solution avant de soumettre.');
      return;
    }

    if (challenge.kind !== 'code') {
      const hasMissing = challenge.quizQuestions.some((_, index) => !(answers[index] || '').trim());
      if (hasMissing) {
        setError('Réponds à toutes les questions avant de soumettre.');
        return;
      }
    }

    if (challenge.kind === 'code') {
      setCodeActiveTabIndex(CODE_TESTS_TAB_INDEX);
    }

    setSaving(true);
    setError('');

    const sessionDurationSec = Math.max(
      1,
      elapsedSec || Math.round((Date.now() - startedAtRef.current) / 1000),
    );

    try {
      const res = await fetch('/api/challenges/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          challenge.kind === 'code'
            ? {
                challengeId,
                kind: 'code',
                studentCode: code,
                durationSec: sessionDurationSec,
              }
            : {
                challengeId,
                kind: 'theory',
                answers,
                durationSec: sessionDurationSec,
              },
        ),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'submit_failed');
      }

      setResult({
        score: Number(data.score ?? 0),
        passed: Boolean(data.passed),
        evaluation: String(data.evaluation ?? ''),
        motivationalMessage:
          typeof data.motivationalMessage === 'string' ? data.motivationalMessage : null,
        evaluationJson:
          data.evaluationJson && typeof data.evaluationJson === 'object'
            ? (data.evaluationJson as SubmitResult['evaluationJson'])
            : null,
      });
    } catch {
      setError('Soumission impossible pour le moment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Chargement du challenge...</div>;
  }

  if (!challenge) {
    return (
      <div className="rounded-2xl border bg-card p-5 space-y-2">
        <p className="text-sm text-muted-foreground">Challenge introuvable.</p>
        <Link href="/challenges" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
      </div>
    );
  }

  if (challenge.kind === 'code') {
    const elapsedLabel = formatElapsed(elapsedSec);

    return (
      <div className="space-y-4">
        <section className="rounded-2xl border bg-card px-3 py-2">
          <Link href="/challenges" className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour à la liste
          </Link>
        </section>

        <section className="rounded-2xl border bg-card p-2">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 min-h-[70vh]">
            <CodeChallengeSidebar
              challengeTitle={challenge.title}
              challengeDescription={challenge.description}
              difficulty={challenge.difficulty}
              challengeSections={challengeSections}
              testCases={challenge.testCases}
              code={code}
              estimatedMinutes={challenge.estimatedMinutes}
              elapsedLabel={elapsedLabel}
              attemptsCount={attempts.length}
              activeTabIndex={codeActiveTabIndex}
              onActiveTabIndexChange={setCodeActiveTabIndex}
              isSubmitting={saving}
              submitResult={result}
            />

            <CodeChallengeEditorPanel
              challenge={challenge}
              challengeId={challengeId}
              code={code}
              onCodeChange={setCode}
              onOpenDebuggerTab={() => setCodeActiveTabIndex(CODE_DEBUGGER_TAB_INDEX)}
              elapsedLabel={elapsedLabel}
              saving={saving}
              onSubmit={submit}
              error={error}
              result={result}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <TheoryChallengePanel
      challenge={challenge}
      challengeId={challengeId}
      answers={answers}
      onAnswerChange={(index, value) =>
        setAnswers((prev) => {
          const next = [...prev];
          next[index] = value;
          return next;
        })
      }
      onSubmit={submit}
      saving={saving}
      error={error}
      result={result}
      elapsedLabel={formatElapsed(elapsedSec)}
    />
  );
}
