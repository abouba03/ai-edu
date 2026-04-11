'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Gauge, Layers3, Target } from 'lucide-react';

type AnalyticsMetric = {
  attempts: number;
  passRate: number;
  avgScore: number;
  avgDurationSec: number;
};

type ByDifficultyRow = {
  difficulty: string;
  attempts: number;
  passRate: number;
  avgScore: number;
};

type ByFormationRow = {
  formation: string;
  attempts: number;
  passRate: number;
  avgScore: number;
};

type TopChallengeRow = {
  title: string;
  attempts: number;
  passRate: number;
  avgScore: number;
};

type AnalyticsResponse = {
  ok?: boolean;
  summary?: AnalyticsMetric;
  byDifficulty?: ByDifficultyRow[];
  byFormation?: ByFormationRow[];
  topChallenges?: TopChallengeRow[];
};

const periodOptions = [7, 30, 90] as const;

function durationLabel(value: number) {
  if (!value || value <= 0) return '--';
  const mins = Math.round(value / 60);
  return `${mins} min`;
}

export default function ChallengeAnalyticsPanel() {
  const [days, setDays] = useState<(typeof periodOptions)[number]>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<AnalyticsResponse>({});

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/challenges/analytics?days=${days}`, { cache: 'no-store' });
        const payload = (await res.json()) as AnalyticsResponse;

        if (!res.ok || !payload?.ok) {
          throw new Error('analytics_load_error');
        }

        if (isMounted) {
          setData(payload);
        }
      } catch {
        if (isMounted) {
          setError('Impossible de charger les analytics pour le moment.');
          setData({});
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [days]);

  const summary = useMemo(
    () =>
      data.summary ?? {
        attempts: 0,
        passRate: 0,
        avgScore: 0,
        avgDurationSec: 0,
      },
    [data.summary],
  );

  return (
    <section className="rounded-2xl border bg-card p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pilotage</p>
          <h3 className="text-lg font-semibold mt-1 inline-flex items-center gap-2"><BarChart3 className="size-4" /> Analytics challenges</h3>
        </div>

        <div className="flex items-center gap-1 rounded-xl border bg-background p-1">
          {periodOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`px-2.5 py-1.5 text-xs rounded-lg transition ${
                days === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {option}j
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-2.5">
          <p className="text-xs text-muted-foreground">Tentatives</p>
          <p className="text-lg font-semibold mt-1">{summary.attempts}</p>
        </div>
        <div className="rounded-xl border bg-background p-2.5">
          <p className="text-xs text-muted-foreground">Taux de réussite</p>
          <p className="text-lg font-semibold mt-1">{summary.passRate}%</p>
        </div>
        <div className="rounded-xl border bg-background p-2.5">
          <p className="text-xs text-muted-foreground">Score moyen</p>
          <p className="text-lg font-semibold mt-1">{summary.avgScore}/100</p>
        </div>
        <div className="rounded-xl border bg-background p-2.5">
          <p className="text-xs text-muted-foreground">Durée moyenne</p>
          <p className="text-lg font-semibold mt-1">{durationLabel(summary.avgDurationSec)}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Chargement des analytics...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          <div className="rounded-xl border bg-background p-3 space-y-2">
            <p className="text-sm font-medium inline-flex items-center gap-1"><Target className="size-4" /> Top challenges</p>
            {(data.topChallenges ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune tentative sur la période.</p>
            ) : (
              (data.topChallenges ?? []).slice(0, 4).map((row) => (
                <div key={row.title} className="rounded-lg border px-2.5 py-2 text-xs flex items-center justify-between gap-2">
                  <p className="line-clamp-1">{row.title}</p>
                  <p className="font-medium">{row.attempts} tent.</p>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border bg-background p-3 space-y-2">
            <p className="text-sm font-medium inline-flex items-center gap-1"><Gauge className="size-4" /> Par niveau</p>
            {(data.byDifficulty ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Pas de distribution niveau.</p>
            ) : (
              (data.byDifficulty ?? []).slice(0, 5).map((row) => (
                <div key={row.difficulty} className="rounded-lg border px-2.5 py-2 text-xs">
                  <p className="font-medium">{row.difficulty}</p>
                  <p className="text-muted-foreground mt-0.5">{row.attempts} tent. • {row.passRate}% réussite • {row.avgScore}/100</p>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border bg-background p-3 space-y-2">
            <p className="text-sm font-medium inline-flex items-center gap-1"><Layers3 className="size-4" /> Par formation</p>
            {(data.byFormation ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Pas de distribution formation.</p>
            ) : (
              (data.byFormation ?? []).slice(0, 5).map((row) => (
                <div key={row.formation} className="rounded-lg border px-2.5 py-2 text-xs">
                  <p className="font-medium line-clamp-1">{row.formation}</p>
                  <p className="text-muted-foreground mt-0.5">{row.attempts} tent. • {row.passRate}% réussite • {row.avgScore}/100</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
