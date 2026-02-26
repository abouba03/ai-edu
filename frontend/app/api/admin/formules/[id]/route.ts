import { getAdminContext } from '@/lib/admin-auth';
import { loadEntityList, normalizeFormule, saveEntityList, type FormuleItem } from '@/lib/admin-entity-store';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  let payload: Partial<FormuleItem>;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const current = await loadEntityList<FormuleItem>('formules');
    const target = current.find((item) => item.id === id);
    if (!target) {
      return Response.json({ ok: false, error: 'formule_not_found' }, { status: 404 });
    }

    const updated = normalizeFormule({ ...target, ...payload, id: target.id, createdAt: target.createdAt });
    const next = current.map((item) => (item.id === id ? updated : item));

    await saveEntityList('formules', next, admin.clerkId ?? null, admin.userId ?? null);
    return Response.json({ ok: true, formule: updated });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formules_update_error';
    return Response.json({ ok: false, error: 'formules_update_error', detail }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  try {
    const current = await loadEntityList<FormuleItem>('formules');
    const next = current.filter((item) => item.id !== id);

    await saveEntityList('formules', next, admin.clerkId ?? null, admin.userId ?? null);
    return Response.json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formules_delete_error';
    return Response.json({ ok: false, error: 'formules_delete_error', detail }, { status: 500 });
  }
}
