'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, Sparkles, Target, Trophy } from 'lucide-react';
import { ChallengeAttemptRow } from '../../_components/types';

type ParsedEvaluation = {
  note: string | null;
  comment: string;
  testsSummary: string | null;
  motivationalMessage: string | null;
  consignes: string[];
  idees: string[];
  nextSteps: string[];
};

function parseEvaluation(value: unknown): ParsedEvaluation {
  if (!value || typeof value !== 'object') {
    return {
      note: null,
      comment: '',
      testsSummary: null,
      motivationalMessage: null,
      consignes: [],
      idees: [],
      nextSteps: [],
    };
  }

  const row = value as Record<string, unknown>;
  const comment = String(row.commentaire || row.comment || row.summary || '').trim();
  const motivationalRaw = row.motivational_message;
  const motivationalMessage = typeof motivationalRaw === 'string' ? motivationalRaw.trim() : '';
  const noteRaw = row.note;
  const note = noteRaw === undefined || noteRaw === null ? null : String(noteRaw);

  let testsSummary: string | null = null;
  if (row.test_summary && typeof row.test_summary === 'object') {
    const summary = row.test_summary as Record<string, unknown>;
    const passed = Number(summary.passed ?? 0);
    const total = Number(summary.total ?? 0);
    testsSummary = `${passed}/${total} tests validés`;
  }

  const consignes = Array.isArray(row.consignes) ? row.consignes.filter((item): item is string => typeof item === 'string') : [];
  const idees = Array.isArray(row.idees) ? row.idees.filter((item): item is string => typeof item === 'string') : [];
  const nextSteps = Array.isArray(row.prochaines_etapes)
    ? row.prochaines_etapes.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    note,
    comment,
    testsSummary,
    motivationalMessage: motivationalMessage || null,
    consignes,
    idees,
    nextSteps,
  };
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return '--';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ChallengeResultPage() {
  const params = useParams<{ challengeId: string }>();
  const challengeId = typeof params?.challengeId === 'string' ? params.challengeId : '';

  const [attempts, setAttempts] = useState<ChallengeAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeId) return;
    let mounted = true;

    async function loadAttempts() {
      setLoading(true);
      try {
        const res = await fetch(`/api/challenges/attempts?challengeId=${challengeId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAttempts();
    return () => {
      mounted = false;
    };
  }, [challengeId]);

  const latestAttempt = useMemo(() => attempts[0] ?? null, [attempts]);

  const metrics = useMemo(() => {
    const total = attempts.length;
    const passed = attempts.filter((attempt) => attempt.passed).length;
    const bestScore = attempts.reduce((best, attempt) => Math.max(best, Number(attempt.score ?? 0)), 0);
    const avgScore = total > 0
      ? Math.round(
          attempts.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / total,
        )
      : 0;
    const totalDurationSec = attempts.reduce((sum, attempt) => sum + Number(attempt.durationSec ?? 0), 0);

    return {
      total,
      passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      bestScore,
      avgScore,
      totalDurationSec,
    };
  }, [attempts]);

  const latestEvaluation = useMemo(() => parseEvaluation(latestAttempt?.evaluation), [latestAttempt]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 lg:p-6 space-y-4">
        <Link href={`/challenges/${challengeId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au challenge
        </Link>

        <div className="rounded-xl border bg-background p-4 lg:p-5 space-y-2">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">Challenge Report</p>
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight">{latestAttempt?.passed ? 'Mission validée, excellent travail 🎉' : 'Continue, tu es proche de la validation 💪'}</h1>
          <p className="text-sm text-muted-foreground">Vue complète de tes performances, feedback IA et progression sur ce challenge.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <article className="rounded-xl border bg-background p-3 space-y-1">
            <p className="text-muted-foreground">Meilleur score</p>
            <p className="text-base font-semibold inline-flex items-center gap-1"><Trophy className="h-4 w-4" /> {metrics.bestScore}/100</p>
          </article>
          <article className="rounded-xl border bg-background p-3 space-y-1">
            <p className="text-muted-foreground">Score moyen</p>
            <p className="text-base font-semibold inline-flex items-center gap-1"><Target className="h-4 w-4" /> {metrics.avgScore}/100</p>
          </article>
          <article className="rounded-xl border bg-background p-3 space-y-1">
            <p className="text-muted-foreground">Réussite</p>
            <p className="text-base font-semibold inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {metrics.passRate}%</p>
          </article>
          <article className="rounded-xl border bg-background p-3 space-y-1">
            <p className="text-muted-foreground">Tentatives</p>
            <p className="text-base font-semibold inline-flex items-center gap-1"><Sparkles className="h-4 w-4" /> {metrics.total}</p>
          </article>
          <article className="rounded-xl border bg-background p-3 space-y-1">
            <p className="text-muted-foreground">Temps total</p>
            <p className="text-base font-semibold inline-flex items-center gap-1"><Clock3 className="h-4 w-4" /> {formatDuration(metrics.totalDurationSec)}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,360px]">
        <article className="rounded-2xl border bg-card p-4 lg:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Dernière tentative</h2>
            {latestAttempt && (
              <span className={`text-xs rounded-full border px-2.5 py-1 ${latestAttempt.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>
                {latestAttempt.passed ? 'Validée' : 'À améliorer'}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : !latestAttempt ? (
            <p className="text-sm text-muted-foreground">Aucune tentative disponible.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border bg-background p-2">
                  <p className="text-muted-foreground">Score</p>
                  <p className="text-sm font-semibold">{typeof latestAttempt.score === 'number' ? `${latestAttempt.score}/100` : '--'}</p>
                </div>
                <div className="rounded-lg border bg-background p-2">
                  <p className="text-muted-foreground">Durée</p>
                  <p className="text-sm font-semibold font-mono">{formatDuration(latestAttempt.durationSec)}</p>
                </div>
                <div className="rounded-lg border bg-background p-2">
                  <p className="text-muted-foreground">Date</p>
                  <p className="text-sm font-semibold">{new Date(latestAttempt.createdAt).toLocaleString('fr-FR')}</p>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-medium">Feedback IA</p>
                  {latestEvaluation.note && (
                    <span className="rounded-full border px-2 py-0.5 text-xs">Note: {latestEvaluation.note}</span>
                  )}
                </div>
                {latestEvaluation.testsSummary && <p className="text-muted-foreground">{latestEvaluation.testsSummary}</p>}
                {latestEvaluation.comment ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{latestEvaluation.comment}</p>
                ) : (
                  <p className="text-muted-foreground">Aucun commentaire détaillé.</p>
                )}
                {latestEvaluation.motivationalMessage && (
                  <p className="rounded-md border bg-card px-2 py-1 text-xs text-primary">{latestEvaluation.motivationalMessage}</p>
                )}
              </div>

              {(latestEvaluation.consignes.length > 0 || latestEvaluation.idees.length > 0 || latestEvaluation.nextSteps.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border bg-background p-2 space-y-1">
                    <p className="font-semibold">Consignes</p>
                    {latestEvaluation.consignes.slice(0, 3).map((item, index) => (
                      <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-background p-2 space-y-1">
                    <p className="font-semibold">Idées</p>
                    {latestEvaluation.idees.slice(0, 3).map((item, index) => (
                      <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-background p-2 space-y-1">
                    <p className="font-semibold">Prochaines étapes</p>
                    {latestEvaluation.nextSteps.slice(0, 3).map((item, index) => (
                      <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </article>

        <aside className="rounded-2xl border bg-card p-4 lg:p-5 space-y-3">
          <h2 className="text-lg font-semibold">Historique complet</h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tentative disponible.</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {attempts.map((attempt, index) => (
                <article key={attempt.id} className="rounded-xl border bg-background p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Tentative #{attempts.length - index}</p>
                    <span className={`rounded-full border px-2 py-0.5 ${attempt.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>
                      {attempt.passed ? 'OK' : 'KO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <p>{new Date(attempt.createdAt).toLocaleString('fr-FR')}</p>
                    <p className="font-medium">{typeof attempt.score === 'number' ? `${attempt.score}/100` : '--'}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <p>Niveau: {attempt.level || '—'}</p>
                    <p className="font-mono">{formatDuration(attempt.durationSec)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
