"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Brain, Sparkles, Target } from 'lucide-react';

const cards = [
  {
    title: 'Génération assistée',
    description: 'Produire du code Python à partir d’un besoin.',
    href: '/generator',
    icon: Sparkles,
  },
  {
    title: 'Debug interactif',
    description: 'Comprendre les erreurs pas à pas avec guidance IA.',
    href: '/debugger',
    icon: Brain,
  },
  {
    title: 'Évaluation active',
    description: 'Mesurer la progression via quiz et défis.',
    href: '/challenges',
    icon: Target,
  },
];

type MiniChallengeKpis = {
  ok: boolean
  summary?: {
    sampleSize: number
    started: number
    completed: number
    abandoned: number
    submissions: number
    resolveClicks: number
    completionRate: number | null
    abandonRate: number | null
    resolveUsageRate: number | null
  }
  topTabs?: Array<{ tab: string; opens: number; avgDurationSec: number }>
  exerciseInsights?: Array<{
    exerciseId: string
    views: number
    completes: number
    conversionRate: number
    bestTests: string
    bestAttemptCount: number | null
  }>
}

type LearnerProgression = {
  metrics?: {
    avgProgress?: number
  }
  recommendation?: {
    reason?: string
  }
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<MiniChallengeKpis | null>(null)
  const [progression, setProgression] = useState<LearnerProgression | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      try {
        const [kpiRes, progressionRes] = await Promise.all([
          fetch('/api/events/mini-challenge-kpis', { cache: 'no-store' }),
          fetch('/api/learner/progression', { cache: 'no-store' }),
        ])

        const [kpiData, progressionData] = await Promise.all([
          kpiRes.json(),
          progressionRes.json(),
        ])

        if (!isMounted) return
        setKpis(kpiData)
        setProgression(progressionData)
      } catch {
        if (!isMounted) return
        setKpis({ ok: false })
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDashboardData()
    return () => {
      isMounted = false
    }
  }, [])

  const topRecommendation = useMemo(() => {
    if (!progression?.recommendation?.reason) return 'Continue avec un mini-challenge pour consolider tes acquis du cours.'
    return progression.recommendation.reason
  }, [progression])

  const summary = kpis?.summary
  const topExercise = kpis?.exerciseInsights?.[0]

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Dashboard pédagogique</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Vue d’ensemble de la plateforme</h1>
        <p className="text-muted-foreground mt-2">
          Ton espace central pour piloter la génération, la correction et le suivi des apprentissages.
        </p>
        <Link
          href="/dashboard/insights"
          className="mt-4 inline-flex items-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Ouvrir le cockpit IA apprenant
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mini-challenges lancés</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : (summary?.started ?? 0)}</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taux de complétion</p>
          <p className="text-2xl font-bold mt-1">
            {loading ? '…' : `${summary?.completionRate ?? 0}%`}
          </p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Usage de Résoudre</p>
          <p className="text-2xl font-bold mt-1">
            {loading ? '…' : `${summary?.resolveUsageRate ?? 0}%`}
          </p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Progression cours</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${progression?.metrics?.avgProgress ?? 0}%`}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Insight principal</h2>
          <p className="text-sm text-muted-foreground">{topRecommendation}</p>
          {topExercise ? (
            <div className="rounded-xl border bg-accent/30 p-3 text-sm text-muted-foreground">
              Exercice le plus fréquent: <span className="font-medium text-foreground">{topExercise.exerciseId}</span> · Conversion {topExercise.conversionRate}% · Meilleur score {topExercise.bestTests}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun exercice récent détecté.</p>
          )}
        </article>

        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Tabs les plus utilisées</h2>
          {(kpis?.topTabs?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Pas assez de données pour afficher les habitudes de navigation.</p>
          ) : (
            <ul className="space-y-2">
              {kpis?.topTabs?.slice(0, 4).map((item) => (
                <li key={item.tab} className="rounded-xl border p-3 flex items-center justify-between text-sm">
                  <span className="font-medium">{item.tab}</span>
                  <span className="text-muted-foreground">{item.opens} ouvertures · {item.avgDurationSec}s</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border bg-card p-5 hover:bg-accent/40 transition-colors space-y-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl border bg-card p-5 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          Conseil: tes signaux d’apprentissage sont disponibles via les endpoints analytics pour faire évoluer les prompts, défis et feedbacks de manière continue.
        </p>
      </section>
    </div>
  );
}
