import { getAdminContext } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

type FormationPayload = {
  name?: string;
  description?: string;
  level?: string;
  targetHours?: number;
  isActive?: boolean;
};

function normalizeFormation(payload: FormationPayload) {
  const name = String(payload.name ?? '').trim();
  if (!name) return { ok: false as const, error: 'name_required' };

  return {
    ok: true as const,
    data: {
      name,
      description: String(payload.description ?? '').trim(),
      level: String(payload.level ?? '').trim() || 'Débutant',
      targetHours: Math.max(1, Math.min(1000, Number(payload.targetHours ?? 20) || 20)),
      isActive: Boolean(payload.isActive ?? true),
    },
  };
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const formations = await prisma.formation.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ ok: true, formations });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formations_load_error';
    return Response.json({ ok: false, error: 'formations_load_error', detail }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  let payload: FormationPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeFormation(payload);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  try {
    const formation = await prisma.formation.create({ data: normalized.data });
    return Response.json({ ok: true, formation }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formations_create_error';
    return Response.json({ ok: false, error: 'formations_create_error', detail }, { status: 500 });
  }
}
