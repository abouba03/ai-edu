import { getAdminContext } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

type FormationPayload = {
  name?: string;
  description?: string;
  level?: string;
  targetHours?: number;
  isActive?: boolean;
};

function normalizeFormationUpdate(payload: FormationPayload) {
  const data: {
    name?: string;
    description?: string;
    level?: string;
    targetHours?: number;
    isActive?: boolean;
  } = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) return { ok: false as const, error: 'name_required' };
    data.name = name;
  }

  if (payload.description !== undefined) {
    data.description = String(payload.description).trim();
  }

  if (payload.level !== undefined) {
    data.level = String(payload.level).trim() || 'Débutant';
  }

  if (payload.targetHours !== undefined) {
    data.targetHours = Math.max(1, Math.min(1000, Number(payload.targetHours) || 20));
  }

  if (payload.isActive !== undefined) {
    data.isActive = Boolean(payload.isActive);
  }

  return { ok: true as const, data };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  let payload: FormationPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeFormationUpdate(payload);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  if (Object.keys(normalized.data).length === 0) {
    return Response.json({ ok: false, error: 'empty_update' }, { status: 400 });
  }

  try {
    const formation = await prisma.formation.update({
      where: { id },
      data: normalized.data,
    });
    return Response.json({ ok: true, formation });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formations_update_error';
    if (detail.includes('Record to update not found')) {
      return Response.json({ ok: false, error: 'formation_not_found' }, { status: 404 });
    }
    return Response.json({ ok: false, error: 'formations_update_error', detail }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  try {
    await prisma.formation.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formations_delete_error';
    if (detail.includes('Record to delete does not exist')) {
      return Response.json({ ok: false, error: 'formation_not_found' }, { status: 404 });
    }
    return Response.json({ ok: false, error: 'formations_delete_error', detail }, { status: 500 });
  }
}
