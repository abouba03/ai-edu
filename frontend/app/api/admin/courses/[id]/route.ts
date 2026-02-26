import prisma from '@/lib/prisma';
import { getAdminContext } from '@/lib/admin-auth';

type CoursePayload = {
  title?: string;
  description?: string;
  level?: string;
  duration?: string;
  modules?: number;
  topics?: string[];
  formationName?: string;
  courseIndex?: number;
};

function normalizeForUpdate(payload: CoursePayload) {
  const data: {
    title?: string;
    description?: string | null;
    level?: string;
    duration?: string | null;
    modules?: number;
    topics?: {
      youtubeLinks: string[];
      formationName: string;
      courseIndex: number;
    };
  } = {};

  const nextFormationName = (payload.formationName ?? '').trim();
  const hasFormationName = typeof payload.formationName === 'string';
  const hasCourseIndex = payload.courseIndex !== undefined;
  const hasTopics = Array.isArray(payload.topics);

  if (typeof payload.title === 'string') {
    const value = payload.title.trim();
    if (!value) {
      return { ok: false as const, error: 'title_empty' };
    }
    data.title = value;
  }

  if (typeof payload.level === 'string') {
    const value = payload.level.trim();
    if (!value) {
      return { ok: false as const, error: 'level_empty' };
    }
    data.level = value;
  }

  if (typeof payload.description === 'string') {
    data.description = payload.description.trim() || null;
  }

  if (typeof payload.duration === 'string') {
    data.duration = payload.duration.trim() || null;
  }

  if (payload.modules !== undefined) {
    data.modules = Math.max(0, Math.min(60, Number(payload.modules)));
  }

  if (hasFormationName || hasCourseIndex || hasTopics) {
    data.topics = {
      youtubeLinks: Array.isArray(payload.topics)
        ? payload.topics.map((topic) => topic.trim()).filter(Boolean)
        : [],
      formationName: nextFormationName || 'Formation générale',
      courseIndex: Math.max(1, Math.min(999, Number(payload.courseIndex ?? 1))),
    };
  }

  return { ok: true as const, data };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  let payload: CoursePayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeForUpdate(payload);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  if (Object.keys(normalized.data).length === 0) {
    return Response.json({ ok: false, error: 'empty_update' }, { status: 400 });
  }

  try {
    const course = await prisma.course.update({
      where: { id },
      data: normalized.data,
    });

    return Response.json({ ok: true, course });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { id } = await params;

  try {
    await prisma.course.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}
