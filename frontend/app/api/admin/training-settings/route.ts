import prisma from '@/lib/prisma';
import { getAdminContext } from '@/lib/admin-auth';

type TrainingSettings = {
  programName: string;
  targetAudience: string;
  pedagogicalStyle: string;
  aiTone: string;
  releaseMode: 'cohort' | 'self-paced' | 'hybrid';
  passThreshold: number;
  weeklyGoalHours: number;
  certificationEnabled: boolean;
  challengeAutoPublish: boolean;
  reminderCadenceDays: number;
};

const defaultSettings: TrainingSettings = {
  programName: 'AI Edu Platform - Parcours Python',
  targetAudience: 'Débutants et intermédiaires',
  pedagogicalStyle: 'Apprentissage actif: micro-leçons + pratique + feedback IA',
  aiTone: 'Coach motivant et précis',
  releaseMode: 'hybrid',
  passThreshold: 70,
  weeklyGoalHours: 5,
  certificationEnabled: true,
  challengeAutoPublish: true,
  reminderCadenceDays: 3,
};

function normalize(payload: Partial<TrainingSettings>): TrainingSettings {
  return {
    programName: (payload.programName ?? '').trim() || defaultSettings.programName,
    targetAudience: (payload.targetAudience ?? '').trim() || defaultSettings.targetAudience,
    pedagogicalStyle: (payload.pedagogicalStyle ?? '').trim() || defaultSettings.pedagogicalStyle,
    aiTone: (payload.aiTone ?? '').trim() || defaultSettings.aiTone,
    releaseMode:
      payload.releaseMode === 'cohort' || payload.releaseMode === 'self-paced' || payload.releaseMode === 'hybrid'
        ? payload.releaseMode
        : defaultSettings.releaseMode,
    passThreshold: Math.max(0, Math.min(100, Number(payload.passThreshold ?? defaultSettings.passThreshold))),
    weeklyGoalHours: Math.max(1, Math.min(40, Number(payload.weeklyGoalHours ?? defaultSettings.weeklyGoalHours))),
    certificationEnabled: Boolean(payload.certificationEnabled ?? defaultSettings.certificationEnabled),
    challengeAutoPublish: Boolean(payload.challengeAutoPublish ?? defaultSettings.challengeAutoPublish),
    reminderCadenceDays: Math.max(1, Math.min(30, Number(payload.reminderCadenceDays ?? defaultSettings.reminderCadenceDays))),
  };
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const latest = await (prisma as any).learningEvent.findFirst({
      where: {
        feature: 'admin_training_settings',
        action: 'save',
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    });

    if (!latest?.metadata || typeof latest.metadata !== 'object') {
      return Response.json({
        ok: true,
        settings: defaultSettings,
        source: 'default',
      });
    }

    return Response.json({
      ok: true,
      settings: normalize(latest.metadata as Partial<TrainingSettings>),
      source: 'event_log',
      updatedAt: latest.createdAt,
    });
  } catch {
    return Response.json({
      ok: true,
      settings: defaultSettings,
      source: 'fallback',
    });
  }
}

export async function PUT(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  let payload: Partial<TrainingSettings>;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const settings = normalize(payload);

  try {
    await (prisma as any).learningEvent.create({
      data: {
        action: 'save',
        feature: 'admin_training_settings',
        status: 'success',
        metadata: settings,
        clerkId: admin.clerkId ?? null,
        userId: admin.userId ?? null,
      },
    });

    return Response.json({ ok: true, settings });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}
