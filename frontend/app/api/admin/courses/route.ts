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

type CourseTopicsPayload = {
  youtubeLinks: string[];
  formationName: string;
  courseIndex: number;
};

function normalizeYoutubeLinks(topics: unknown) {
  if (!Array.isArray(topics)) {
    return [] as string[];
  }

  return topics
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeCourse(payload: CoursePayload) {
  const title = (payload.title ?? '').trim();
  const level = (payload.level ?? '').trim();

  if (!title || !level) {
    return { ok: false as const, error: 'title_and_level_required' };
  }

  const topics: CourseTopicsPayload = {
    youtubeLinks: normalizeYoutubeLinks(payload.topics),
    formationName: (payload.formationName ?? '').trim() || 'Formation générale',
    courseIndex: Math.max(1, Math.min(999, Number(payload.courseIndex ?? 1))),
  };

  return {
    ok: true as const,
    data: {
      title,
      description: (payload.description ?? '').trim() || null,
      level,
      duration: (payload.duration ?? '').trim() || null,
      modules: Math.max(0, Math.min(60, Number(payload.modules ?? 0))),
      topics,
    },
  };
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  try {
    const courses = await prisma.course.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return Response.json({ ok: true, courses });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  let payload: CoursePayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeCourse(payload);
  if (!normalized.ok) {
    return Response.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  try {
    const course = await prisma.course.create({
      data: {
        title: normalized.data.title,
        description: normalized.data.description,
        level: normalized.data.level,
        duration: normalized.data.duration,
        modules: normalized.data.modules,
        topics: normalized.data.topics,
      },
    });

    return Response.json({ ok: true, course }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'database_unavailable';
    return Response.json({ ok: false, error: 'database_unavailable', detail }, { status: 500 });
  }
}
