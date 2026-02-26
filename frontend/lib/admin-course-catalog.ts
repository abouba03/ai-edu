import prisma from '@/lib/prisma';

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

const RUSSIAN_PYTHON_FORMATION = 'Formation Python (russe)';
const RUSSIAN_PLAYLIST = 'PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa';

const RUSSIAN_PYTHON_LESSONS: Array<{
  index: number;
  duration: string;
  title: string;
  url: string;
  description: string;
}> = [
  {
    index: 1,
    duration: '5:29',
    title: 'Уроки Python с нуля / #1 – Программирование на Питон для начинающих',
    url: `https://www.youtube.com/playlist?list=${RUSSIAN_PLAYLIST}&index=1`,
    description: 'Introduction au parcours Python et compréhension du déroulé global (cours en russe).',
  },
  {
    index: 2,
    duration: '11:06',
    title: 'Уроки Python с нуля / #2 – Установка среды разработки',
    url: 'https://www.youtube.com/watch?v=CfqX2_xY8VQ&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=2',
    description: 'Installation de l’environnement de développement et préparation du poste de travail.',
  },
  {
    index: 3,
    duration: '19:34',
    title: 'Уроки Python с нуля / #3 – Базовые операции в языке Python',
    url: 'https://www.youtube.com/watch?v=ML5tP8m6SHw&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=3',
    description: 'Découverte des opérations de base et des premières manipulations Python.',
  },
  {
    index: 4,
    duration: '21:52',
    title: 'Уроки Python с нуля / #4 – Переменные и типы данных',
    url: 'https://www.youtube.com/watch?v=DZvNZ9l9NT4&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=4',
    description: 'Variables, types de données et bonnes pratiques de déclaration.',
  },
  {
    index: 5,
    duration: '23:11',
    title: 'Уроки Python с нуля / #5 – Условные операторы',
    url: 'https://www.youtube.com/watch?v=SUDNfS_0X-Q&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=5',
    description: 'Structures conditionnelles `if/elif/else` pour piloter le flux logique.',
  },
  {
    index: 6,
    duration: '15:49',
    title: 'Уроки Python с нуля / #6 – Циклы и операторы в них (for, while)',
    url: 'https://www.youtube.com/watch?v=vMD6-jzgDvI&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=6',
    description: 'Boucles `for` et `while`, avec logique d’itération efficace.',
  },
  {
    index: 7,
    duration: '26:43',
    title: 'Уроки Python с нуля / #7 – Списки (list). Функции и их методы',
    url: 'https://www.youtube.com/watch?v=-X2ubBdP2Ak&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=7',
    description: 'Manipulation des listes et méthodes fondamentales en pratique.',
  },
  {
    index: 8,
    duration: '22:40',
    title: 'Уроки Python с нуля / #8 – Функции строк. Индексы и срезы',
    url: 'https://www.youtube.com/watch?v=pqaBWcsBGyA&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=8',
    description: 'Fonctions de chaînes, indexation et slicing pour le traitement de texte.',
  },
  {
    index: 9,
    duration: '10:31',
    title: 'Уроки Python с нуля / #9 – Кортежи (tuple)',
    url: 'https://www.youtube.com/watch?v=cQfu-hYo2o4&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=9',
    description: 'Introduction aux tuples et différences clés avec les listes.',
  },
  {
    index: 10,
    duration: '16:10',
    title: 'Уроки Python с нуля / #10 – Словари (dict) и работа с ними',
    url: 'https://www.youtube.com/watch?v=W2oO1Y-QDzo&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=10',
    description: 'Utilisation des dictionnaires pour structurer et rechercher des données.',
  },
  {
    index: 11,
    duration: '8:10',
    title: 'Уроки Python с нуля / #11 – Множества (set и frozenset)',
    url: 'https://www.youtube.com/watch?v=6eNtZ8wY7qI&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=11',
    description: 'Ensembles `set/frozenset` et opérations utiles sur les collections.',
  },
  {
    index: 12,
    duration: '22:21',
    title: 'Уроки Python с нуля / #12 – Функции (def, lambda)',
    url: 'https://www.youtube.com/watch?v=6K5v4--G__U&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=12',
    description: 'Création de fonctions classiques et anonymes (`lambda`).',
  },
  {
    index: 13,
    duration: '13:17',
    title: 'Уроки Python с нуля / #13 – Работа с файлами за счет Питон',
    url: 'https://www.youtube.com/watch?v=t-xQAhLNYSs&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=13',
    description: 'Lecture/écriture de fichiers pour les premiers scripts persistants.',
  },
  {
    index: 14,
    duration: '10:32',
    title: 'Уроки Python с нуля / #14 – Обработчик исключений. Конструкция «try - except»',
    url: 'https://www.youtube.com/watch?v=3nveLco08Y0&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=14',
    description: 'Gestion des exceptions avec `try/except` pour un code plus robuste.',
  },
  {
    index: 15,
    duration: '6:20',
    title: 'Уроки Python с нуля / #15 – Менеджер «With ... as» для работы с файлами',
    url: 'https://www.youtube.com/watch?v=uGsSTZjUoIc&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=15',
    description: 'Gestionnaire `with ... as` pour manipuler les ressources proprement.',
  },
  {
    index: 16,
    duration: '21:05',
    title: 'Уроки Python с нуля / #16 – Модули в языке Питон. Создание и работа с модулями',
    url: 'https://www.youtube.com/watch?v=dNg3l-wpRdY&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=16',
    description: 'Création de modules et organisation d’un code Python réutilisable.',
  },
  {
    index: 17,
    duration: '15:00',
    title: 'Уроки Python с нуля / #17 – Основы ООП. Создание класса и объекта',
    url: 'https://www.youtube.com/watch?v=gFRa6qVN980&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=17',
    description: 'Fondamentaux de la POO: classes, objets et premiers modèles.',
  },
  {
    index: 18,
    duration: '8:54',
    title: 'Уроки Python с нуля / #18 – Конструкторы, переопределение методов',
    url: 'https://www.youtube.com/watch?v=Y6N-na2WOx8&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=18',
    description: 'Constructeurs et redéfinition de méthodes en programmation objet.',
  },
  {
    index: 19,
    duration: '18:28',
    title: 'Уроки Python с нуля / #19 – Наследование, инкапсуляция, полиморфизм',
    url: 'https://www.youtube.com/watch?v=4N4GSzLF7JM&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=19',
    description: 'Héritage, encapsulation et polymorphisme: piliers de la POO.',
  },
  {
    index: 20,
    duration: '8:01',
    title: 'Уроки Python с нуля / #20 – Декораторы функций',
    url: 'https://www.youtube.com/watch?v=tuFuDKE7DF8&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=20',
    description: 'Décorateurs de fonctions pour factoriser et enrichir le comportement.',
  },
  {
    index: 21,
    duration: '2:00',
    title: 'Уроки Python с нуля / #21 – Заключительная часть',
    url: 'https://www.youtube.com/watch?v=-viVz4cwDU4&list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa&index=21',
    description: 'Conclusion du parcours et synthèse des compétences acquises.',
  },
];

function getRussianPythonPresetCourses(): AdminVideoCourse[] {
  return RUSSIAN_PYTHON_LESSONS.map((lesson) => ({
    id: `preset-ru-python-${lesson.index}`,
    slug: `preset-ru-python-${lesson.index}`,
    title: lesson.title,
    description: `${lesson.description} Durée estimée: ${lesson.duration}.`,
    level: 'Débutant',
    duration: lesson.duration,
    modules: 1,
    videoLinks: [lesson.url],
    formationName: RUSSIAN_PYTHON_FORMATION,
    courseIndex: lesson.index,
  }));
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

export async function getAdminCourseCatalog(): Promise<AdminVideoCourse[]> {
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

export async function getAdminCourseBySlug(slug: string) {
  const presetCourse = getRussianPythonPresetCourses().find((course) => course.slug === slug);
  if (presetCourse) {
    return {
      ...presetCourse,
      readableSlug: slugify(presetCourse.title),
    };
  }

  if (!slug.startsWith('admin-')) {
    return null;
  }

  const id = slug.replace('admin-', '').trim();
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
  const currentCourse = courses.find((course) => course.slug === slug);

  if (!currentCourse) {
    return null;
  }

  const formationCourses = courses
    .filter((course) => course.formationName === currentCourse.formationName)
    .sort((a, b) => a.courseIndex - b.courseIndex);

  const position = formationCourses.findIndex((course) => course.slug === slug);
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
