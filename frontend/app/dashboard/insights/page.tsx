'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Brain,
  Gauge,
  Save,
  Sparkles,
  UserCircle2,
} from 'lucide-react'

type MeResponse = {
  name?: string
  level?: string
}

type LearnerProgressionResponse = {
  ok?: boolean
  learner?: {
    email?: string
    level?: string
  }
  metrics?: {
    avgProgress?: number
    successfulEvents?: number
    totalEvents?: number
  }
  recommendation?: {
    reason?: string
  }
}

type MiniKpisResponse = {
  ok?: boolean
  summary?: {
    sampleSize?: number
    started: number
    completed?: number
    submissions?: number
    completionRate: number | null
    resolveUsageRate: number | null
    abandonRate: number | null
    debuggerStartRate?: number | null
  }
  funnel?: {
    viewed?: number
    submitted?: number
    completed?: number
    abandoned?: number
  }
  quality?: {
    avgTestsPassRate?: number | null
    avgAttemptsToComplete?: number | null
    stuckAfterTwoRate?: number | null
  }
  timeEfficiency?: {
    medianTimeOnTaskSec?: number | null
    fastSuccessRate?: number | null
    longLowScoreRate?: number | null
  }
  helperUsage?: {
    resolveUsageRate?: number | null
    debuggerStartRate?: number | null
  }
  retention?: {
    weeklyActiveDays?: number
    replayAfter48hRate?: number | null
  }
  topErrors?: Array<{ category: string; count: number }>
  recommendations?: string[]
  autoActions?: Array<{
    id: string
    title: string
    reason: string
    status: 'executed' | 'ready'
    settingPatch: Partial<AiSettings>
  }>
  kpiBoard?: Array<{
    key: string
    label: string
    value: number | null
    target: string
    status: 'good' | 'watch' | 'risk'
  }>
  topTabs?: Array<{ tab: string; opens: number; avgDurationSec: number }>
}

type AiSettings = {
  preferredLevel: 'débutant' | 'intermédiaire' | 'avancé'
  aiTone: string
  pedagogicalStyle: string
  explanationLanguage: string
  weeklyGoalHours: number
  passThreshold: number
  challengeMode: 'guidé' | 'autonome' | 'hybride'
  focusTopics: string[]
  hintsEnabled: boolean
}

const defaultSettings: AiSettings = {
  preferredLevel: 'débutant',
  aiTone: 'Coach motivant et clair',
  pedagogicalStyle: 'Pratique active avec feedback court et actionnable',
  explanationLanguage: 'français',
  weeklyGoalHours: 5,
  passThreshold: 70,
  challengeMode: 'hybride',
  focusTopics: [],
  hintsEnabled: true,
}

export default function InsightsDashboardPage() {
  const [me, setMe] = useState<MeResponse>({})
  const [progression, setProgression] = useState<LearnerProgressionResponse>({})
  const [kpis, setKpis] = useState<MiniKpisResponse>({})
  const [settings, setSettings] = useState<AiSettings>(defaultSettings)
  const [focusInput, setFocusInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [applyingAutoActions, setApplyingAutoActions] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [meRes, progressionRes, kpiRes, settingsRes] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }),
          fetch('/api/learner/progression', { cache: 'no-store' }),
          fetch('/api/events/mini-challenge-kpis', { cache: 'no-store' }),
          fetch('/api/learner/ai-settings', { cache: 'no-store' }),
        ])

        const [meData, progressionData, kpiData, settingsData] = await Promise.all([
          meRes.json(),
          progressionRes.json(),
          kpiRes.json(),
          settingsRes.json(),
        ])

        if (!isMounted) return
        setMe(meData)
        setProgression(progressionData)
        setKpis(kpiData)
        setSettings(settingsData?.settings ?? defaultSettings)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const analyticsAdvice = useMemo(() => {
    if ((kpis.recommendations?.length ?? 0) > 0) {
      return (kpis.recommendations ?? []).slice(0, 4)
    }

    const completion = kpis.summary?.completionRate ?? 0
    const resolveRate = kpis.summary?.resolveUsageRate ?? 0
    const avgProgress = progression.metrics?.avgProgress ?? 0

    const tips: string[] = []
    if (completion < 55) tips.push('Réduire légèrement la difficulté des prochains mini-challenges.')
    if (resolveRate > 40) tips.push('Activer plus de feedback pas-à-pas avant le bouton Résoudre.')
    if (avgProgress < 60) tips.push('Monter la cadence des checkpoints courts (3-5 questions) après chaque vidéo.')
    if (tips.length === 0) tips.push('Rythme solide: augmenter progressivement le niveau et diminuer les indices automatiques.')

    return tips.slice(0, 4)
  }, [
    kpis.recommendations,
    kpis.summary?.completionRate,
    kpis.summary?.resolveUsageRate,
    progression.metrics?.avgProgress,
  ])

  function statusClass(status: 'good' | 'watch' | 'risk'): string {
    if (status === 'good') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
    if (status === 'watch') return 'border-amber-300 bg-amber-50 text-amber-700'
    return 'border-rose-300 bg-rose-50 text-rose-700'
  }

  async function saveSettings() {
    setSaving(true)
    setSaveMessage('')

    try {
      const res = await fetch('/api/learner/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'save_failed')
      }
      setSettings(data.settings)
      setSaveMessage('Préférences enregistrées. L’IA utilisera ces réglages dans les prochains modules.')
    } catch {
      setSaveMessage('Impossible d’enregistrer pour le moment. Réessaie dans quelques secondes.')
    } finally {
      setSaving(false)
    }
  }

  async function applyReadyAutoActions() {
    const readyActions = (kpis.autoActions ?? []).filter((action) => action.status === 'ready')
    if (readyActions.length === 0) {
      setSaveMessage('Aucune action automatique à appliquer pour le moment.')
      return
    }

    const mergedPatch = readyActions.reduce<Partial<AiSettings>>((acc, action) => {
      return { ...acc, ...action.settingPatch }
    }, {})

    const nextSettings: AiSettings = {
      ...settings,
      ...mergedPatch,
    }

    setApplyingAutoActions(true)
    setSaveMessage('')

    try {
      const res = await fetch('/api/learner/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'auto_apply_failed')
      }

      setSettings(data.settings)
      setKpis((current) => ({
        ...current,
        autoActions: (current.autoActions ?? []).map((action) => ({
          ...action,
          status: 'executed',
        })),
      }))
      setSaveMessage(`Actions automatiques appliquées: ${readyActions.length}.`)
    } catch {
      setSaveMessage('Impossible d’appliquer les actions automatiques pour le moment.')
    } finally {
      setApplyingAutoActions(false)
    }
  }

  function addFocusTopic() {
    const value = focusInput.trim()
    if (!value) return
    if (settings.focusTopics.includes(value)) {
      setFocusInput('')
      return
    }
    setSettings((current) => ({ ...current, focusTopics: [...current.focusTopics, value].slice(0, 12) }))
    setFocusInput('')
  }

  function removeFocusTopic(topic: string) {
    setSettings((current) => ({ ...current, focusTopics: current.focusTopics.filter((item) => item !== topic) }))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Cockpit IA apprenant</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Pilotage data & personnalisation</h1>
        <p className="text-muted-foreground mt-2">
          Cette page centralise ton profil, les analytics d’apprentissage et les réglages que tu peux modifier pour mieux orienter l’IA.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><UserCircle2 className="h-3.5 w-3.5" /> Utilisateur</p>
          <p className="text-base font-semibold mt-1">{loading ? '…' : (me.name ?? 'Étudiant')}</p>
          <p className="text-xs text-muted-foreground mt-1">{progression.learner?.email ?? '-'}</p>
        </article>

        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> Progression moyenne</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${progression.metrics?.avgProgress ?? 0}%`}</p>
        </article>

        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Taux de complétion</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${kpis.summary?.completionRate ?? 0}%`}</p>
        </article>

        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Usage Résoudre</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${kpis.summary?.resolveUsageRate ?? 0}%`}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Funnel: Viewed</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : (kpis.funnel?.viewed ?? 0)}</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Funnel: Submitted</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : (kpis.funnel?.submitted ?? 0)}</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Qualité tests moyenne</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${kpis.quality?.avgTestsPassRate ?? 0}%`}</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Rétention +48h</p>
          <p className="text-2xl font-bold mt-1">{loading ? '…' : `${kpis.retention?.replayAfter48hRate ?? 0}%`}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Conseils data analytics</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {analyticsAdvice.map((tip, index) => (
              <li key={`${tip}-${index}`}>• {tip}</li>
            ))}
          </ul>
          {progression.recommendation?.reason && (
            <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
              Recommandation intelligente: {progression.recommendation.reason}
            </div>
          )}
        </article>

        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold inline-flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Habitudes de navigation</h2>
          {(kpis.topTabs?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Pas assez de données pour afficher les habitudes de navigation.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.topTabs?.slice(0, 5).map((tab) => (
                <li key={tab.tab} className="rounded-lg border bg-background p-3 text-sm flex items-center justify-between gap-3">
                  <span className="font-medium">{tab.tab}</span>
                  <span className="text-muted-foreground">{tab.opens} ouvertures · {tab.avgDurationSec}s</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Qualité des tentatives</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Tentatives moyennes avant validation: <span className="text-foreground font-medium">{kpis.quality?.avgAttemptsToComplete ?? 'N/A'}</span></p>
            <p>• Stagnation après 2 soumissions: <span className="text-foreground font-medium">{kpis.quality?.stuckAfterTwoRate ?? 0}%</span></p>
            <p>• Tests passés moyens: <span className="text-foreground font-medium">{kpis.quality?.avgTestsPassRate ?? 0}%</span></p>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Temps & efficacité</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Temps médian / challenge: <span className="text-foreground font-medium">{kpis.timeEfficiency?.medianTimeOnTaskSec ?? 0}s</span></p>
            <p>• Succès rapides (&lt;10 min): <span className="text-foreground font-medium">{kpis.timeEfficiency?.fastSuccessRate ?? 0}%</span></p>
            <p>• Long + faible score: <span className="text-foreground font-medium">{kpis.timeEfficiency?.longLowScoreRate ?? 0}%</span></p>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Aides & rétention</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Debugger déclenché: <span className="text-foreground font-medium">{kpis.helperUsage?.debuggerStartRate ?? 0}%</span></p>
            <p>• Résoudre utilisé: <span className="text-foreground font-medium">{kpis.helperUsage?.resolveUsageRate ?? 0}%</span></p>
            <p>• Jours actifs (7j): <span className="text-foreground font-medium">{kpis.retention?.weeklyActiveDays ?? 0}</span></p>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">KPI board (hebdo)</h2>
          {(kpis.kpiBoard?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun KPI board disponible.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.kpiBoard?.map((item) => (
                <li key={item.key} className={`rounded-lg border px-3 py-2 text-sm ${statusClass(item.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.label}</span>
                    <span>{item.value ?? 'N/A'}</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">Cible: {item.target}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Top erreurs dominantes</h2>
          {(kpis.topErrors?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Pas assez de signaux erreur pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.topErrors?.map((item) => (
                <li key={item.category} className="rounded-lg border bg-background p-3 text-sm flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">{item.category}</span>
                  <span className="text-muted-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold">Actions auto exécutées</h2>
          <button
            type="button"
            onClick={applyReadyAutoActions}
            disabled={applyingAutoActions || (kpis.autoActions?.filter((item) => item.status === 'ready').length ?? 0) === 0}
            className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {applyingAutoActions ? 'Application…' : 'Appliquer les actions prêtes'}
          </button>
        </div>

        {(kpis.autoActions?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune action auto nécessaire actuellement.</p>
        ) : (
          <ul className="space-y-2">
            {kpis.autoActions?.map((action) => (
              <li key={action.id} className="rounded-lg border bg-background p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{action.title}</p>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${action.status === 'executed' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                    {action.status === 'executed' ? 'Exécutée' : 'Prête'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{action.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Préférences IA modifiables (persistées)</h2>
        <p className="text-sm text-muted-foreground">
          Ces données sont stockées et utilisées pour orienter les prompts, le style de feedback et le niveau de challenge.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Niveau préféré</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.preferredLevel}
              onChange={(event) => setSettings((current) => ({ ...current, preferredLevel: event.target.value as AiSettings['preferredLevel'] }))}
            >
              <option value="débutant">Débutant</option>
              <option value="intermédiaire">Intermédiaire</option>
              <option value="avancé">Avancé</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Mode challenge</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.challengeMode}
              onChange={(event) => setSettings((current) => ({ ...current, challengeMode: event.target.value as AiSettings['challengeMode'] }))}
            >
              <option value="guidé">Guidé</option>
              <option value="hybride">Hybride</option>
              <option value="autonome">Autonome</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Ton IA</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.aiTone}
              onChange={(event) => setSettings((current) => ({ ...current, aiTone: event.target.value }))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Langue d’explication</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.explanationLanguage}
              onChange={(event) => setSettings((current) => ({ ...current, explanationLanguage: event.target.value }))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Objectif hebdo (heures)</span>
            <input
              type="number"
              min={1}
              max={40}
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.weeklyGoalHours}
              onChange={(event) => setSettings((current) => ({ ...current, weeklyGoalHours: Number(event.target.value || 5) }))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Seuil de validation (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.passThreshold}
              onChange={(event) => setSettings((current) => ({ ...current, passThreshold: Number(event.target.value || 70) }))}
            />
          </label>
        </div>

        <label className="text-sm space-y-1 block">
          <span className="text-muted-foreground">Style pédagogique</span>
          <textarea
            className="w-full min-h-24 rounded-lg border bg-background px-3 py-2"
            value={settings.pedagogicalStyle}
            onChange={(event) => setSettings((current) => ({ ...current, pedagogicalStyle: event.target.value }))}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Sujets de focus (pour orienter l’IA)</p>
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="ex: boucles, fonctions, debugging"
              value={focusInput}
              onChange={(event) => setFocusInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addFocusTopic()
                }
              }}
            />
            <button type="button" className="rounded-lg border px-3 text-sm hover:bg-accent" onClick={addFocusTopic}>Ajouter</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.focusTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => removeFocusTopic(topic)}
                className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent"
                title="Cliquer pour retirer"
              >
                {topic} ✕
              </button>
            ))}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.hintsEnabled}
            onChange={(event) => setSettings((current) => ({ ...current, hintsEnabled: event.target.checked }))}
          />
          Activer les indices automatiques dans les défis
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? 'Enregistrement...' : 'Enregistrer mes préférences'}
          </button>
          {saveMessage && <p className="text-sm text-muted-foreground">{saveMessage}</p>}
        </div>
      </section>
    </div>
  )
}
