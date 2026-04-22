import prisma from '@/lib/prisma';

export type FormationItem = {
  id: string;
  name: string;
  description: string;
  level: string;
  targetHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FormuleItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  maxCourses: number;
  maxLearners: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EntityKind = 'formations' | 'formules';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

export async function loadEntityList<T>(kind: EntityKind): Promise<T[]> {
  let latest: { metadata: unknown } | null = null;

  try {
    latest = await (prisma as any).learningEvent.findFirst({
      where: { feature: 'admin_entities', action: `save_${kind}` },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
  } catch {
    // Fallback for local/dev runs where database credentials are not configured.
    return [];
  }

  const metadata = latest?.metadata;
  if (!isRecord(metadata)) return [];

  const rawItems = metadata.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems as T[];
}

export async function saveEntityList<T>(
  kind: EntityKind,
  items: T[],
  clerkId: string | null,
  userId: string | null
) {
  try {
    await (prisma as any).learningEvent.create({
      data: {
        action: `save_${kind}`,
        feature: 'admin_entities',
        status: 'success',
        clerkId,
        userId,
        metadata: {
          kind,
          items,
          updatedAt: nowIso(),
        },
      },
    });
  } catch {
    // Ignore persistence failure in offline/dev mode.
  }
}

export function normalizeFormation(payload: Partial<FormationItem>): FormationItem {
  const current = nowIso();
  return {
    id: String(payload.id || '').trim() || crypto.randomUUID(),
    name: String(payload.name || '').trim() || 'Formation sans nom',
    description: String(payload.description || '').trim(),
    level: String(payload.level || '').trim() || 'Débutant',
    targetHours: Math.max(1, Math.min(1000, Number(payload.targetHours ?? 20))),
    isActive: Boolean(payload.isActive ?? true),
    createdAt: String(payload.createdAt || current),
    updatedAt: current,
  };
}

export function normalizeFormule(payload: Partial<FormuleItem>): FormuleItem {
  const current = nowIso();
  const cycle = String(payload.billingCycle || 'monthly');
  const billingCycle: 'monthly' | 'quarterly' | 'yearly' =
    cycle === 'quarterly' || cycle === 'yearly' ? cycle : 'monthly';

  const features = Array.isArray(payload.features)
    ? payload.features.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    id: String(payload.id || '').trim() || crypto.randomUUID(),
    name: String(payload.name || '').trim() || 'Formule sans nom',
    description: String(payload.description || '').trim(),
    price: Math.max(0, Number(payload.price ?? 0)),
    billingCycle,
    features,
    maxCourses: Math.max(0, Number(payload.maxCourses ?? 0)),
    maxLearners: Math.max(0, Number(payload.maxLearners ?? 0)),
    isActive: Boolean(payload.isActive ?? true),
    createdAt: String(payload.createdAt || current),
    updatedAt: current,
  };
}
