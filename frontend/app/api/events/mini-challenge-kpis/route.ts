import prisma from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

type EventRow = {
  action: string
  status: string
  metadata: unknown
  createdAt: Date
}

type EventMetadata = {
  exerciseId?: unknown
  tab?: unknown
  testsPassed?: unknown
  testsTotal?: unknown
  note?: unknown
  attemptCount?: unknown
  timeOnTaskSec?: unknown
  previousTabDurationSec?: unknown
}

type LearnerAiSettings = {
  preferredLevel?: 'débutant' | 'intermédiaire' | 'avancé'
  challengeMode?: 'guidé' | 'autonome' | 'hybride'
  hintsEnabled?: boolean
  passThreshold?: number
  aiTone?: string
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseNoteOverTen(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(10, value))
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/)
    if (!match) return null
    const parsed = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(parsed)) return null
    return Math.max(0, Math.min(10, parsed))
  }

  return null
}

function round1(value: number): number {
  return Number(value.toFixed(1))
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[index]
}

function classifyBlocker(value: string): string {
  const text = value.toLowerCase()
  if (/syntaxe|python|indent|parenth|variable|erreur/.test(text)) return 'syntaxe'
  if (/logique|algorith|raisonnement|etape|étape|condition/.test(text)) return 'logique'
  if (/test|assert|cas limite|edge/.test(text)) return 'tests'
  return 'compréhension'
}

type AutoAction = {
  id: string
  title: string
  reason: string
  status: 'executed' | 'ready'
  settingPatch: Partial<LearnerAiSettings>
}

export async function GET(req: Request) {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  try {
    let clerkId = 'local'
    if (!isAuthDisabled) {
      const authData = await auth()
      if (!authData.userId) {
        return new Response('Unauthorized', { status: 401 })
      }
      clerkId = authData.userId
    }

    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get('limit') || 2000)
    const limit = Number.isFinite(limitParam) ? Math.max(100, Math.min(limitParam, 5000)) : 2000

    const [events, recentReflections, recentChallenges, latestAiSettingsEvent]: [
      EventRow[],
      Array<{ unclear: string | null }>,
      Array<{ evaluation: unknown }>,
      { metadata: unknown } | null
    ] = await Promise.all([
      (prisma as unknown as { learningEvent: { findMany: (args: Record<string, unknown>) => Promise<EventRow[]> } }).learningEvent.findMany({
        where: {
          clerkId,
          feature: 'course_mini_challenge_page',
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          action: true,
          status: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.courseReflection.findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { unclear: true },
      }),
      prisma.courseChallengeAttempt.findMany({
        where: { clerkId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { evaluation: true },
      }),
      (prisma as unknown as { learningEvent: { findFirst: (args: Record<string, unknown>) => Promise<{ metadata: unknown } | null> } }).learningEvent.findFirst({
        where: {
          clerkId,
          feature: 'learner_ai_settings',
          action: 'save_settings',
        },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      }),
    ])

    const currentSettings = asObject(latestAiSettingsEvent?.metadata) as LearnerAiSettings

    const started = events.filter((event) => event.action === 'challenge_viewed' && event.status === 'success').length
    const completed = events.filter((event) => event.action === 'exercise_completed' && event.status === 'success').length
    const abandoned = events.filter((event) => event.action === 'exercise_abandoned' && event.status === 'error').length
    const resolveClicks = events.filter((event) => event.action === 'challenge_resolved_clicked' && event.status === 'start').length
    const submissions = events.filter((event) => event.action === 'mini_challenge_submitted' && event.status === 'success').length
    const debuggerStarts = events.filter((event) => event.action === 'debug_started' && event.status === 'start').length

    const completionRate = started > 0 ? round1((completed / started) * 100) : null
    const abandonRate = started > 0 ? round1((abandoned / started) * 100) : null
    const resolveUsageRate = submissions > 0 ? round1((resolveClicks / submissions) * 100) : null
    const debuggerStartRate = started > 0 ? round1((debuggerStarts / started) * 100) : null

    const tabCounter = new Map<string, number>()
    const tabDurationAgg = new Map<string, { total: number; count: number }>()
    const submissionCountsByExercise = new Map<string, number>()
    const completionByExercise = new Set<string>()
    const viewTimesByExercise = new Map<string, number[]>()

    const submissionPassRates: number[] = []
    const completionAttemptCounts: number[] = []
    const completionTimes: number[] = []
    const submissionTimes: number[] = []
    let longLowScoreCount = 0

    const exerciseAgg = new Map<string, {
      views: number
      completes: number
      bestPassed: number
      bestTotal: number
      bestAttemptCount: number | null
    }>()

    for (const event of events) {
      const metadata = asObject(event.metadata) as EventMetadata
      const exerciseId = asString(metadata.exerciseId) ?? 'unknown'

      if (event.action === 'mini_challenge_submitted' && event.status === 'success') {
        submissionCountsByExercise.set(exerciseId, (submissionCountsByExercise.get(exerciseId) ?? 0) + 1)

        const passed = asNumber(metadata.testsPassed)
        const total = asNumber(metadata.testsTotal)
        if (passed !== null && total !== null && total > 0) {
          submissionPassRates.push((passed / total) * 100)
        }

        const timeOnTask = asNumber(metadata.timeOnTaskSec)
        if (timeOnTask !== null && timeOnTask > 0) {
          submissionTimes.push(timeOnTask)
        }

        const note = parseNoteOverTen(metadata.note)
        if (timeOnTask !== null && timeOnTask >= 1200 && note !== null && note < 7) {
          longLowScoreCount += 1
        }
      }

      if (event.action === 'challenge_viewed' && event.status === 'success') {
        const existingViews = viewTimesByExercise.get(exerciseId) ?? []
        existingViews.push(event.createdAt.getTime())
        viewTimesByExercise.set(exerciseId, existingViews)

        const current = exerciseAgg.get(exerciseId) ?? {
          views: 0,
          completes: 0,
          bestPassed: 0,
          bestTotal: 0,
          bestAttemptCount: null,
        }
        current.views += 1
        exerciseAgg.set(exerciseId, current)
      }

      if (event.action === 'exercise_completed' && event.status === 'success') {
        completionByExercise.add(exerciseId)

        const current = exerciseAgg.get(exerciseId) ?? {
          views: 0,
          completes: 0,
          bestPassed: 0,
          bestTotal: 0,
          bestAttemptCount: null,
        }
        current.completes += 1

        const attemptCount = asNumber(metadata.attemptCount)
        if (attemptCount !== null) {
          completionAttemptCounts.push(attemptCount)
          if (current.bestAttemptCount === null || attemptCount < current.bestAttemptCount) {
            current.bestAttemptCount = attemptCount
          }
        }

        const timeOnTask = asNumber(metadata.timeOnTaskSec)
        if (timeOnTask !== null && timeOnTask > 0) {
          completionTimes.push(timeOnTask)
        }

        const passed = asNumber(metadata.testsPassed)
        const total = asNumber(metadata.testsTotal)
        if (passed !== null && total !== null && passed >= current.bestPassed) {
          current.bestPassed = passed
          current.bestTotal = total
        }
        exerciseAgg.set(exerciseId, current)
      }

      if (event.action === 'tab_opened') {
        const tab = asString(metadata.tab) ?? 'unknown'
        tabCounter.set(tab, (tabCounter.get(tab) ?? 0) + 1)
        const duration = asNumber(metadata.previousTabDurationSec)
        if (duration !== null && duration >= 0) {
          const current = tabDurationAgg.get(tab) ?? { total: 0, count: 0 }
          current.total += duration
          current.count += 1
          tabDurationAgg.set(tab, current)
        }
      }
    }

    const topTabs = Array.from(tabCounter.entries())
      .map(([tab, count]) => {
        const agg = tabDurationAgg.get(tab)
        return {
          tab,
          opens: count,
          avgDurationSec: agg && agg.count > 0 ? round1(agg.total / agg.count) : 0,
        }
      })
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 6)

    const exerciseInsights = Array.from(exerciseAgg.entries())
      .map(([exerciseId, data]) => ({
        exerciseId,
        views: data.views,
        completes: data.completes,
        conversionRate: data.views > 0 ? round1((data.completes / data.views) * 100) : 0,
        bestTests: data.bestTotal > 0 ? `${data.bestPassed}/${data.bestTotal}` : 'N/A',
        bestAttemptCount: data.bestAttemptCount,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)

    const avgTestsPassRate = submissionPassRates.length > 0
      ? round1(submissionPassRates.reduce((sum, value) => sum + value, 0) / submissionPassRates.length)
      : null

    const avgAttemptsToComplete = completionAttemptCounts.length > 0
      ? round1(completionAttemptCounts.reduce((sum, value) => sum + value, 0) / completionAttemptCounts.length)
      : null

    const stalledExercises = Array.from(submissionCountsByExercise.entries()).filter(
      ([exerciseId, count]) => count >= 2 && !completionByExercise.has(exerciseId)
    ).length

    const twoPlusSubmissionExercises = Array.from(submissionCountsByExercise.values()).filter((count) => count >= 2).length

    const stuckAfterTwoRate = twoPlusSubmissionExercises > 0
      ? round1((stalledExercises / twoPlusSubmissionExercises) * 100)
      : null

    const medianTimeOnTaskSec = percentile(submissionTimes, 50)
    const fastSuccessRate = completionTimes.length > 0
      ? round1((completionTimes.filter((seconds) => seconds <= 600).length / completionTimes.length) * 100)
      : null

    const longLowScoreRate = submissions > 0 ? round1((longLowScoreCount / submissions) * 100) : null

    const now = Date.now()
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
    const activeDays = new Set(
      events
        .filter((event) => event.createdAt.getTime() >= sevenDaysAgo)
        .map((event) => event.createdAt.toISOString().slice(0, 10))
    ).size

    let revisitedAfter48hCount = 0
    for (const timestamps of viewTimesByExercise.values()) {
      if (timestamps.length < 2) continue
      const sorted = [...timestamps].sort((a, b) => a - b)
      const first = sorted[0]
      const revisited = sorted.some((time) => (time - first) >= (48 * 60 * 60 * 1000))
      if (revisited) revisitedAfter48hCount += 1
    }

    const retentionReplayRate = started > 0 ? round1((revisitedAfter48hCount / started) * 100) : null

    const blockerCounter = new Map<string, number>()
    for (const reflection of recentReflections) {
      const unclear = (reflection.unclear || '').trim()
      if (!unclear) continue
      const category = classifyBlocker(unclear)
      blockerCounter.set(category, (blockerCounter.get(category) ?? 0) + 1)
    }

    for (const challenge of recentChallenges) {
      const evalObject = asObject(challenge.evaluation)
      const comment = asString(evalObject.commentaire)
      if (!comment) continue
      const category = classifyBlocker(comment)
      blockerCounter.set(category, (blockerCounter.get(category) ?? 0) + 1)
    }

    const topErrors = Array.from(blockerCounter.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const recommendations: string[] = []
    if ((completionRate ?? 100) < 60) recommendations.push('Baisser légèrement la difficulté initiale et renforcer le guidage sur la première tentative.')
    if ((stuckAfterTwoRate ?? 0) >= 30) recommendations.push('Déclencher automatiquement un hint ciblé après 2 soumissions sans progression.')
    if ((longLowScoreRate ?? 0) >= 20) recommendations.push('Proposer un micro-quiz de 3 questions quand le temps est élevé mais le score reste bas.')
    if ((resolveUsageRate ?? 0) > 40) recommendations.push('Ajouter une étape debugger obligatoire avant le bouton Résoudre.')
    if ((retentionReplayRate ?? 100) < 25) recommendations.push('Planifier un re-test J+2/J+7 pour ancrer les notions faibles.')
    if (recommendations.length === 0) {
      recommendations.push('Maintenir la progression actuelle et augmenter progressivement l’autonomie (moins d’indices).')
    }

    const kpiBoard = [
      {
        key: 'funnel_completion',
        label: 'Funnel completion',
        value: completionRate,
        target: '>= 70%',
        status: (completionRate ?? 0) >= 70 ? 'good' : (completionRate ?? 0) >= 55 ? 'watch' : 'risk',
      },
      {
        key: 'quality_attempts',
        label: 'Tentatives moyennes avant validation',
        value: avgAttemptsToComplete,
        target: '<= 3',
        status: (avgAttemptsToComplete ?? 99) <= 3 ? 'good' : (avgAttemptsToComplete ?? 99) <= 4 ? 'watch' : 'risk',
      },
      {
        key: 'stuck_after_two',
        label: 'Stagnation après 2 soumissions',
        value: stuckAfterTwoRate,
        target: '<= 25%',
        status: (stuckAfterTwoRate ?? 0) <= 25 ? 'good' : (stuckAfterTwoRate ?? 0) <= 35 ? 'watch' : 'risk',
      },
      {
        key: 'helper_resolve_usage',
        label: 'Usage Résoudre',
        value: resolveUsageRate,
        target: '<= 35%',
        status: (resolveUsageRate ?? 0) <= 35 ? 'good' : (resolveUsageRate ?? 0) <= 45 ? 'watch' : 'risk',
      },
      {
        key: 'retention_replay',
        label: 'Rejeu à +48h',
        value: retentionReplayRate,
        target: '>= 30%',
        status: (retentionReplayRate ?? 0) >= 30 ? 'good' : (retentionReplayRate ?? 0) >= 20 ? 'watch' : 'risk',
      },
      {
        key: 'weekly_active_days',
        label: 'Jours actifs (7j)',
        value: activeDays,
        target: '>= 3 jours',
        status: activeDays >= 3 ? 'good' : activeDays >= 2 ? 'watch' : 'risk',
      },
    ]

    const autoActions: AutoAction[] = []

    if ((stuckAfterTwoRate ?? 0) >= 30) {
      const patch: Partial<LearnerAiSettings> = { hintsEnabled: true }
      const executed = currentSettings.hintsEnabled === true
      autoActions.push({
        id: 'enable_hints_after_stall',
        title: 'Activer les indices automatiques',
        reason: 'Stagnation élevée après 2 soumissions.',
        status: executed ? 'executed' : 'ready',
        settingPatch: patch,
      })
    }

    if ((resolveUsageRate ?? 0) > 40) {
      const patch: Partial<LearnerAiSettings> = { challengeMode: 'guidé' }
      const executed = currentSettings.challengeMode === 'guidé'
      autoActions.push({
        id: 'switch_guided_mode',
        title: 'Basculer en mode challenge guidé',
        reason: 'Usage du bouton Résoudre trop élevé.',
        status: executed ? 'executed' : 'ready',
        settingPatch: patch,
      })
    }

    if ((completionRate ?? 100) < 60) {
      const patch: Partial<LearnerAiSettings> = {
        preferredLevel: 'débutant',
        aiTone: 'Coach pas-à-pas, clair et rassurant',
      }
      const executed = currentSettings.preferredLevel === 'débutant'
      autoActions.push({
        id: 'decrease_difficulty_floor',
        title: 'Réduire la difficulté de base',
        reason: 'Taux de complétion global faible.',
        status: executed ? 'executed' : 'ready',
        settingPatch: patch,
      })
    }

    if ((longLowScoreRate ?? 0) >= 20) {
      const patch: Partial<LearnerAiSettings> = { passThreshold: 65 }
      const threshold = asNumber(currentSettings.passThreshold)
      const executed = threshold !== null && threshold <= 65
      autoActions.push({
        id: 'lower_pass_threshold',
        title: 'Assouplir temporairement le seuil de validation',
        reason: 'Temps élevé avec score faible détecté.',
        status: executed ? 'executed' : 'ready',
        settingPatch: patch,
      })
    }

    return Response.json({
      ok: true,
      promptVersion: 'v2.0-mini-challenge-kpis',
      summary: {
        sampleSize: events.length,
        started,
        completed,
        abandoned,
        submissions,
        resolveClicks,
        completionRate,
        abandonRate,
        resolveUsageRate,
        debuggerStartRate,
      },
      funnel: {
        viewed: started,
        submitted: submissions,
        completed,
        abandoned,
      },
      quality: {
        avgTestsPassRate,
        avgAttemptsToComplete,
        stuckAfterTwoRate,
      },
      timeEfficiency: {
        medianTimeOnTaskSec,
        fastSuccessRate,
        longLowScoreRate,
      },
      helperUsage: {
        resolveUsageRate,
        debuggerStartRate,
      },
      retention: {
        weeklyActiveDays: activeDays,
        replayAfter48hRate: retentionReplayRate,
      },
      topErrors,
      recommendations,
      autoActions,
      kpiBoard,
      topTabs,
      exerciseInsights,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'kpi_error'
    return Response.json({ ok: false, error: 'kpi_error', detail }, { status: 500 })
  }
}
