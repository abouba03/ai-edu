import prisma from '@/lib/prisma';
import { getAdminContext } from '@/lib/admin-auth';

type TopicPayload = {
  formationName?: unknown;
};

type StudentMetric = {
  clerkId: string;
  name: string;
  email: string;
  started: number;
  succeeded: number;
  failed: number;
  completionRate: number | null;
};

function parseFormationName(topics: unknown) {
  if (!topics || typeof topics !== 'object' || Array.isArray(topics)) {
    return 'Formation générale';
  }
  const payload = topics as TopicPayload;
  if (typeof payload.formationName === 'string' && payload.formationName.trim()) {
    return payload.formationName.trim();
  }
  return 'Formation générale';
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');
}

export async function GET(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return Response.json({ ok: false, error: admin.reason ?? 'unauthorized' }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const exportFormat = searchParams.get('export');

  try {
    const [events, users, progresses, courses] = await Promise.all([
      prisma.learningEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3000,
        select: {
          clerkId: true,
          action: true,
          status: true,
          feature: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          clerkId: true,
          displayName: true,
          email: true,
        },
      }),
      prisma.progress.findMany({
        select: {
          userId: true,
          courseId: true,
          progressPercentage: true,
          completedModules: true,
          lastAccessed: true,
        },
      }),
      prisma.course.findMany({
        select: {
          id: true,
          title: true,
          topics: true,
          modules: true,
        },
      }),
    ]);

    const userByClerk = new Map(users.map((user) => [user.clerkId, user]));
    const userById = new Map(users.map((user) => [user.id, user]));
    const courseById = new Map(courses.map((course) => [course.id, course]));

    const byStudentMap = new Map<string, StudentMetric>();

    for (const event of events) {
      if (!event.clerkId) continue;
      const user = userByClerk.get(event.clerkId);
      const key = event.clerkId;
      const current = byStudentMap.get(key) ?? {
        clerkId: key,
        name: user?.displayName?.trim() || 'Étudiant',
        email: user?.email || '-',
        started: 0,
        succeeded: 0,
        failed: 0,
        completionRate: null,
      };

      if (event.status === 'start') current.started += 1;
      if (event.status === 'success') current.succeeded += 1;
      if (event.status === 'error') current.failed += 1;

      byStudentMap.set(key, current);
    }

    const byStudent = Array.from(byStudentMap.values())
      .map((item) => ({
        ...item,
        completionRate: item.started > 0 ? Number(((item.succeeded / item.started) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => (b.succeeded - a.succeeded) || (a.failed - b.failed));

    const errorCounter = new Map<string, number>();
    for (const event of events) {
      if (event.status !== 'error') continue;
      const key = `${event.feature}:${event.action}`;
      errorCounter.set(key, (errorCounter.get(key) ?? 0) + 1);
    }

    const frequentErrors = Array.from(errorCounter.entries())
      .map(([key, count]) => {
        const [feature, action] = key.split(':');
        return { feature, action, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const formationAggregation = new Map<string, {
      formationName: string;
      learners: Set<string>;
      avgProgressAccumulator: number;
      entries: number;
    }>();

    const courseAggregation = new Map<string, {
      courseId: string;
      courseTitle: string;
      formationName: string;
      learners: Set<string>;
      avgProgressAccumulator: number;
      entries: number;
    }>();

    for (const item of progresses) {
      const user = userById.get(item.userId);
      const course = courseById.get(item.courseId);
      if (!user || !course) continue;

      const formationName = parseFormationName(course.topics);
      const learnerKey = user.clerkId;
      const progress = Math.max(0, Math.min(100, item.progressPercentage));

      const formationEntry = formationAggregation.get(formationName) ?? {
        formationName,
        learners: new Set<string>(),
        avgProgressAccumulator: 0,
        entries: 0,
      };
      formationEntry.learners.add(learnerKey);
      formationEntry.avgProgressAccumulator += progress;
      formationEntry.entries += 1;
      formationAggregation.set(formationName, formationEntry);

      const courseKey = course.id;
      const courseEntry = courseAggregation.get(courseKey) ?? {
        courseId: course.id,
        courseTitle: course.title,
        formationName,
        learners: new Set<string>(),
        avgProgressAccumulator: 0,
        entries: 0,
      };
      courseEntry.learners.add(learnerKey);
      courseEntry.avgProgressAccumulator += progress;
      courseEntry.entries += 1;
      courseAggregation.set(courseKey, courseEntry);
    }

    const formationProgress = Array.from(formationAggregation.values())
      .map((entry) => ({
        formationName: entry.formationName,
        learners: entry.learners.size,
        averageProgress: entry.entries > 0 ? Number((entry.avgProgressAccumulator / entry.entries).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.averageProgress - a.averageProgress);

    const courseProgress = Array.from(courseAggregation.values())
      .map((entry) => ({
        courseId: entry.courseId,
        courseTitle: entry.courseTitle,
        formationName: entry.formationName,
        learners: entry.learners.size,
        averageProgress: entry.entries > 0 ? Number((entry.avgProgressAccumulator / entry.entries).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.averageProgress - a.averageProgress);

    const summary = {
      totalStudents: users.length,
      totalEvents: events.length,
      totalErrors: events.filter((event) => event.status === 'error').length,
      totalSuccess: events.filter((event) => event.status === 'success').length,
    };

    if (exportFormat === 'csv') {
      const studentRows = [
        ['section', 'clerkId', 'name', 'email', 'started', 'succeeded', 'failed', 'completionRate'],
        ...byStudent.map((item) => [
          'student',
          item.clerkId,
          item.name,
          item.email,
          String(item.started),
          String(item.succeeded),
          String(item.failed),
          item.completionRate === null ? '-' : String(item.completionRate),
        ]),
      ];

      const errorRows = [
        ['section', 'feature', 'action', 'count'],
        ...frequentErrors.map((item) => ['error', item.feature, item.action, String(item.count)]),
      ];

      const formationRows = [
        ['section', 'formationName', 'learners', 'averageProgress'],
        ...formationProgress.map((item) => [
          'formation',
          item.formationName,
          String(item.learners),
          String(item.averageProgress),
        ]),
      ];

      const courseRows = [
        ['section', 'courseId', 'courseTitle', 'formationName', 'learners', 'averageProgress'],
        ...courseProgress.map((item) => [
          'course',
          item.courseId,
          item.courseTitle,
          item.formationName,
          String(item.learners),
          String(item.averageProgress),
        ]),
      ];

      const csv = [toCsv(studentRows), toCsv(errorRows), toCsv(formationRows), toCsv(courseRows)].join('\n\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="admin-analytics.csv"',
        },
      });
    }

    return Response.json({
      ok: true,
      promptVersion: 'v2.1',
      summary,
      byStudent,
      frequentErrors,
      progression: {
        formation: formationProgress,
        course: courseProgress,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'analytics_error';
    return Response.json({ ok: false, error: 'analytics_error', detail }, { status: 500 });
  }
}
