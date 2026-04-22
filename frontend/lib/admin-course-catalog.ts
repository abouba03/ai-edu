import { unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';
import { courseCatalog } from '@/lib/course-catalog';

export type AdminVideoCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  modules: number;
  videoLinks: string[];
  formationName: string;
  courseIndex: number;
};

export type YouTubeResource = {
  sourceUrl: string;
  embedUrl: string;
};

function getRussianPythonPresetCourses(): AdminVideoCourse[] {
  return courseCatalog
    .filter((course) => course.formationName)
    .map((course) => ({
      id: `preset-${course.slug}`,
      slug: `preset-${course.slug}`,
      title: course.title,
      description: course.description,
      level: course.level,
      duration: course.duration,
      modules: course.modules.length,
      videoLinks: course.playlistUrl ? [course.playlistUrl] : [],
      formationName: course.formationName ?? 'Formation générale',
      courseIndex: course.courseIndex ?? 0,
    }));
}

function normalizePresetSlug(slug: string) {
  const trimmed = slug.trim();
  const presetCourses = getRussianPythonPresetCourses();

  if (presetCourses.some((course) => course.slug === trimmed)) {
    return trimmed;
  }

  const legacyMatch = trimmed.match(/^preset-ru-python-(\d+)$/);
  if (legacyMatch) {
    const targetIndex = Number(legacyMatch[1]);
    const mapped = presetCourses.find((course) => Number(course.courseIndex) === targetIndex);
    if (mapped) {
      return mapped.slug;
    }
  }

  return trimmed;
}

export function toCanonicalCourseSlug(slug: string) {
  const normalized = normalizePresetSlug(slug);
  if (normalized.startsWith('preset-')) {
    return normalized.replace(/^preset-/, '');
  }
  return normalized;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'cours';
}

type ParsedTopics = {
  youtubeLinks: string[];
  formationName: string;
  courseIndex: number;
};

export function parseCourseTopics(topics: unknown): ParsedTopics {
  if (Array.isArray(topics)) {
    return {
      youtubeLinks: topics
        .filter((item): item is string => typeof item === 'string')
        .map((value) => value.trim())
        .filter((value) => /^https?:\/\//i.test(value))
        .filter((value) => value.includes('youtube.com') || value.includes('youtu.be')),
      formationName: 'Formation générale',
      courseIndex: 1,
    };
  }

  if (!topics || typeof topics !== 'object') {
    return { youtubeLinks: [], formationName: 'Formation générale', courseIndex: 1 };
  }

  const raw = topics as {
    youtubeLinks?: unknown;
    formationName?: unknown;
    courseIndex?: unknown;
  };

  const youtubeLinks = Array.isArray(raw.youtubeLinks)
    ? raw.youtubeLinks
        .filter((item): item is string => typeof item === 'string')
        .map((value) => value.trim())
        .filter((value) => /^https?:\/\//i.test(value))
        .filter((value) => value.includes('youtube.com') || value.includes('youtu.be'))
    : [];

  const formationName =
    typeof raw.formationName === 'string' && raw.formationName.trim().length > 0
      ? raw.formationName.trim()
      : 'Formation générale';

  const courseIndex = Math.max(1, Math.min(999, Number(raw.courseIndex ?? 1)));

  return { youtubeLinks, formationName, courseIndex };
}

export function extractCourseVideoLinks(topics: unknown) {
  return parseCourseTopics(topics).youtubeLinks;
}

function parseYouTubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v');
      if (id) {
        return `https://www.youtube-nocookie.com/embed/${id}`;
      }

      const list = url.searchParams.get('list');
      if (list) {
        return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
      }

      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2 && (pathSegments[0] === 'shorts' || pathSegments[0] === 'embed')) {
        return `https://www.youtube-nocookie.com/embed/${pathSegments[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function toYouTubeResources(videoLinks: string[]): YouTubeResource[] {
  const seen = new Set<string>();
  const resources: YouTubeResource[] = [];

  for (const link of videoLinks) {
    const embedUrl = parseYouTubeEmbedUrl(link);
    if (!embedUrl || seen.has(embedUrl)) {
      continue;
    }

    seen.add(embedUrl);
    resources.push({
      sourceUrl: link,
      embedUrl,
    });
  }

  return resources;
}

async function _getAdminCourseCatalog(): Promise<AdminVideoCourse[]> {
  const presetCourses = getRussianPythonPresetCourses();

  try {
    const courses = await prisma.course.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    const dbCourses = courses.map((course) => {
      const parsedTopics = parseCourseTopics(course.topics);

      return {
        id: course.id,
        slug: `admin-${course.id}`,
        title: course.title,
        description: course.description ?? 'Cours vidéo administré depuis le panel formation.',
        level: course.level,
        duration: course.duration ?? 'N/A',
        modules: course.modules,
        videoLinks: parsedTopics.youtubeLinks,
        formationName: parsedTopics.formationName,
        courseIndex: parsedTopics.courseIndex,
      };
    });

    return [...dbCourses, ...presetCourses];
  } catch {
    return presetCourses;
  }
}

export const getAdminCourseCatalog = unstable_cache(
  _getAdminCourseCatalog,
  ['admin-course-catalog'],
  { revalidate: 30 },
);

export async function getAdminCourseBySlug(slug: string) {
  const normalizedSlug = normalizePresetSlug(slug);
  const presetCourse = getRussianPythonPresetCourses().find((course) => course.slug === normalizedSlug);
  if (presetCourse) {
    return {
      ...presetCourse,
      readableSlug: slugify(presetCourse.title),
    };
  }

  if (!normalizedSlug.startsWith('admin-')) {
    return null;
  }

  const id = normalizedSlug.replace('admin-', '').trim();
  if (!id) {
    return null;
  }

  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return null;
    }

    const parsedTopics = parseCourseTopics(course.topics);

    return {
      id: course.id,
      slug: `admin-${course.id}`,
      title: course.title,
      description: course.description ?? 'Cours vidéo administré depuis le panel formation.',
      level: course.level,
      duration: course.duration ?? 'N/A',
      modules: course.modules,
      videoLinks: parsedTopics.youtubeLinks,
      formationName: parsedTopics.formationName,
      courseIndex: parsedTopics.courseIndex,
      readableSlug: slugify(course.title),
    };
  } catch {
    return null;
  }
}

export async function getFormationProgressBySlug(slug: string) {
  const courses = await getAdminCourseCatalog();
  const normalizedSlug = normalizePresetSlug(slug);
  const currentCourse = courses.find((course) => course.slug === normalizedSlug);

  if (!currentCourse) {
    return null;
  }

  const formationCourses = courses
    .filter((course) => course.formationName === currentCourse.formationName)
    .sort((a, b) => a.courseIndex - b.courseIndex);

  const position = formationCourses.findIndex((course) => course.slug === normalizedSlug);
  const courseNumber = position >= 0 ? position + 1 : 1;
  const totalCourses = Math.max(1, formationCourses.length);
  const progressPercent = Math.round((courseNumber / totalCourses) * 100);
  const nextCourse = formationCourses[position + 1] ?? null;

  return {
    courseNumber,
    totalCourses,
    progressPercent,
    nextCourseSlug: nextCourse?.slug ?? null,
    nextCourseTitle: nextCourse?.title ?? null,
  };
}

