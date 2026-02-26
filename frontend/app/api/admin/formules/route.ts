import { getAdminContext } from '@/lib/admin-auth';
import { loadEntityList, normalizeFormule, saveEntityList, type FormuleItem } from '@/lib/admin-entity-store';

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const formules = await loadEntityList<FormuleItem>('formules');
    return Response.json({ ok: true, formules });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formules_load_error';
    return Response.json({ ok: false, error: 'formules_load_error', detail }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  let payload: Partial<FormuleItem>;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const current = await loadEntityList<FormuleItem>('formules');
    const item = normalizeFormule(payload);
    const next = [item, ...current];

    await saveEntityList('formules', next, admin.clerkId ?? null, admin.userId ?? null);
    return Response.json({ ok: true, formule: item }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formules_create_error';
    return Response.json({ ok: false, error: 'formules_create_error', detail }, { status: 500 });
  }
}
