import prisma from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

type LearnerAiSettings = {
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

const defaults: LearnerAiSettings = {
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

function toLevel(value: unknown): LearnerAiSettings['preferredLevel'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.includes('avanc')) return 'avancé'
  if (normalized.includes('inter')) return 'intermédiaire'
  return 'débutant'
}

function toChallengeMode(value: unknown): LearnerAiSettings['challengeMode'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'guidé' || normalized === 'guide') return 'guidé'
  if (normalized === 'autonome') return 'autonome'
  return 'hybride'
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function normalize(input: Partial<LearnerAiSettings>): LearnerAiSettings {
  return {
    preferredLevel: toLevel(input.preferredLevel),
    aiTone: (input.aiTone ?? '').trim() || defaults.aiTone,
    pedagogicalStyle: (input.pedagogicalStyle ?? '').trim() || defaults.pedagogicalStyle,
    explanationLanguage: (input.explanationLanguage ?? '').trim() || defaults.explanationLanguage,
    weeklyGoalHours: Math.max(1, Math.min(40, Number(input.weeklyGoalHours ?? defaults.weeklyGoalHours))),
    passThreshold: Math.max(0, Math.min(100, Number(input.passThreshold ?? defaults.passThreshold))),
    challengeMode: toChallengeMode(input.challengeMode),
    focusTopics: toStringArray(input.focusTopics),
    hintsEnabled: Boolean(input.hintsEnabled ?? defaults.hintsEnabled),
  }
}

async function resolveActor() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  if (!isAuthDisabled) {
    const authData = await auth()
    if (!authData.userId) return { clerkId: null as string | null, userId: null as string | null, unauthorized: true }
    const user = await prisma.user.findUnique({ where: { clerkId: authData.userId }, select: { id: true } })
    return { clerkId: authData.userId, userId: user?.id ?? null, unauthorized: false }
  }

  const localUser = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, clerkId: true } })
  return {
    clerkId: localUser?.clerkId ?? 'local',
    userId: localUser?.id ?? null,
    unauthorized: false,
  }
}

export async function GET() {
  const actor = await resolveActor()
  if (actor.unauthorized || !actor.clerkId) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const latest = await (prisma as any).learningEvent.findFirst({
      where: {
        clerkId: actor.clerkId,
        feature: 'learner_ai_settings',
        action: 'save_settings',
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    })

    if (!latest?.metadata || typeof latest.metadata !== 'object') {
      return Response.json({ ok: true, settings: defaults, source: 'default' })
    }

    return Response.json({
      ok: true,
      settings: normalize(latest.metadata as Partial<LearnerAiSettings>),
      source: 'event_log',
      updatedAt: latest.createdAt,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable'
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const actor = await resolveActor()
  if (actor.unauthorized || !actor.clerkId) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: Partial<LearnerAiSettings>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const settings = normalize(payload)

  try {
    await (prisma as any).learningEvent.create({
      data: {
        action: 'save_settings',
        feature: 'learner_ai_settings',
        status: 'success',
        metadata: settings,
        clerkId: actor.clerkId,
        userId: actor.userId,
      },
    })

    if (actor.userId) {
      await prisma.user.update({
        where: { id: actor.userId },
        data: { level: settings.preferredLevel },
      })
    }

    return Response.json({ ok: true, settings })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable'
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 })
  }
}
