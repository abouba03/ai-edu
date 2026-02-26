import { getAdminContext } from '@/lib/admin-auth';
import { loadEntityList, normalizeFormation, saveEntityList, type FormationItem } from '@/lib/admin-entity-store';

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const formations = await loadEntityList<FormationItem>('formations');
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

  let payload: Partial<FormationItem>;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const current = await loadEntityList<FormationItem>('formations');
    const item = normalizeFormation(payload);
    const next = [item, ...current];

    await saveEntityList('formations', next, admin.clerkId ?? null, admin.userId ?? null);
    return Response.json({ ok: true, formation: item }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'formations_create_error';
    return Response.json({ ok: false, error: 'formations_create_error', detail }, { status: 500 });
  }
}
