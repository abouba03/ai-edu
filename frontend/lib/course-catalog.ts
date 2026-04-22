export type CourseLesson = {
  id: string;
  title: string;
  type: 'concept' | 'practice' | 'video';
  durationMin: number;
  summary: string;
  youtubeId?: string;
};

export type CourseModule = {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
};

export type Course = {
  slug: string;
  title: string;
  level: 'Débutant' | 'Intermédiaire' | 'Avancé';
  duration: string;
  description: string;
  playlistUrl?: string;
  playlistId?: string;
  objectives: string[];
  prerequisites: string[];
  modules: CourseModule[];
  formationName?: string;
  courseIndex?: number;
};

const PYTHON_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa';
const PYTHON_PLAYLIST_ID = 'PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa';

export const courseCatalog: Course[] = [
  {
    slug: 'operations-et-variables-python',
    title: 'Переменные и Операции',
    level: 'Débutant',
    duration: '42m',
    description: 'Научитесь работать с числами, текстом и переменными. Узнайте все основные типы данных и как с ними работать. Это фундамент вашего кода.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Использовать основные математические операции',
      'Создавать и работать с переменными',
      'Понимать типы данных в Python',
    ],
    prerequisites: ['Partie 1 terminée'],
    formationName: 'Formation Python Russe',
    courseIndex: 1,
    modules: [
      {
        id: 'm1',
        title: 'Bases de calcul et données',
        description: 'Noyau technique de départ.',
        lessons: [
          {
            id: 'l1',
            title: 'Урок #3 – Базовые операции в языке Python',
            type: 'video',
            durationMin: 20,
            summary: 'Opérations de base du langage Python (19:34).',
          },
          {
            id: 'l2',
            title: 'Урок #4 – Переменные и типы данных',
            type: 'video',
            durationMin: 22,
            summary: 'Variables et types de données (21:52).',
          },
        ],
      },
    ],
  },
  {
    slug: 'conditions-et-boucles-python',
    title: 'Условия и Циклы',
    level: 'Débutant',
    duration: '39m',
    description: 'Управляйте логикой программы с условиями if/else и циклами for/while. Научитесь принимать решения в коде и повторять действия.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Писать условные блоки if/else',
      'Использовать циклы for и while правильно',
      'Контролировать поток выполнения программы',
    ],
    prerequisites: ['Parties 1 et 2'],
    formationName: 'Formation Python Russe',
    courseIndex: 2,
    modules: [
      {
        id: 'm1',
        title: 'Contrôle de flux',
        description: 'Conditions et itérations essentielles.',
        lessons: [
          {
            id: 'l1',
            title: 'Урок #5 – Условные операторы',
            type: 'video',
            durationMin: 24,
            summary: 'Conditions et structures if/else (23:11).',
          },
          {
            id: 'l2',
            title: 'Урок #6 – Циклы for/while',
            type: 'video',
            durationMin: 16,
            summary: 'Boucles, opérateurs et patterns d’itération (15:49).',
          },
        ],
      },
    ],
  },
  {
    slug: 'listes-strings-slices',
    title: 'Списки и Строки',
    level: 'Débutant',
    duration: '50m',
    description: 'Работайте со списками и текстом. Научитесь нумеровать элементы, вырезать части данных и обрабатывать последовательности как профессионал.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Создавать и изменять списки',
      'Использовать индексы и срезы (slicing)',
      'Выполнять операции со строками текста',
    ],
    prerequisites: ['Parties 1 à 3'],
    formationName: 'Formation Python Russe',
    courseIndex: 3,
    modules: [
      {
        id: 'm1',
        title: 'Collections textuelles',
        description: 'Listes et chaînes en pratique.',
        lessons: [
          {
            id: 'l1',
            title: 'Урок #7 – Списки (list). Функции и методы',
            type: 'video',
            durationMin: 27,
            summary: 'Listes Python et méthodes principales (26:43).',
          },
          {
            id: 'l2',
            title: 'Урок #8 – Функции строк. Индексы и срезы',
            type: 'video',
            durationMin: 23,
            summary: 'Chaînes, indices et slicing (22:40).',
          },
        ],
      },
    ],
  },
  {
    slug: 'tuples-dictionnaires-sets',
    title: 'Кортежи, Словари и Множества',
    level: 'Intermédiaire',
    duration: '35m',
    description: 'Откройте новые типы данных! Словари для хранения ключей и значений, множества для уникальных элементов, кортежи для неизменяемых данных.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Использовать кортежи и понимать их особенности',
      'Работать со словарями и ключами',
      'Применять множества и операции между ними',
    ],
    prerequisites: ['Parties 1 à 4'],
    formationName: 'Formation Python Russe',
    courseIndex: 4,
    modules: [
      {
        id: 'm1',
        title: 'Structures avancées',
        description: 'Tuple, dictionnaire, ensemble.',
        lessons: [
          { id: 'l1', title: 'Урок #9 – Кортежи (tuple)', type: 'video', durationMin: 11, summary: 'Introduction aux tuples et usages (10:31).' },
          { id: 'l2', title: 'Урок #10 – Словари (dict)', type: 'video', durationMin: 17, summary: 'Utilisation et manipulation des dictionnaires (16:10).' },
          { id: 'l3', title: 'Урок #11 – Множества (set и frozenset)', type: 'video', durationMin: 9, summary: 'Ensembles et différences avec les listes (8:10).' },
        ],
      },
    ],
  },
  {
    slug: 'fonctions-fichiers-python',
    title: 'Функции и Файлы',
    level: 'Intermédiaire',
    duration: '36m',
    description: 'Пишите переиспользуемый код с функциями. Научитесь читать и писать файлы. Создавайте профессиональные программы, которые можно переиспользовать.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Определять и вызывать функции',
      'Использовать лямбда-функции где нужно',
      'Читать и писать файлы правильно',
    ],
    prerequisites: ['Parties 1 à 5'],
    formationName: 'Formation Python Russe',
    courseIndex: 5,
    modules: [
      {
        id: 'm1',
        title: 'Réutilisabilité du code',
        description: 'Fonctions et I/O fichier.',
        lessons: [
          { id: 'l1', title: 'Урок #12 – Функции (def, lambda)', type: 'video', durationMin: 23, summary: 'Fonctions nommées et lambda (22:21).' },
          { id: 'l2', title: 'Урок #13 – Работа с файлами', type: 'video', durationMin: 14, summary: 'Manipulation de fichiers en Python (13:17).' },
        ],
      },
    ],
  },
  {
    slug: 'exceptions-with-modules',
    title: 'Исключения и Модули',
    level: 'Intermédiaire',
    duration: '38m',
    description: 'Создавайте надежный код, который правильно обрабатывает ошибки. Организуйте код в модули и работайте с ресурсами безопасно.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Обрабатывать ошибки с try/except',
      'Использовать менеджер контекста with',
      'Создавать и импортировать модули',
    ],
    prerequisites: ['Parties 1 à 6'],
    formationName: 'Formation Python Russe',
    courseIndex: 6,
    modules: [
      {
        id: 'm1',
        title: 'Robustesse et modularité',
        description: 'Sécuriser et découper le code.',
        lessons: [
          { id: 'l1', title: 'Урок #14 – try / except', type: 'video', durationMin: 11, summary: 'Gestion des exceptions (10:32).' },
          { id: 'l2', title: 'Урок #15 – Менеджер With ... as', type: 'video', durationMin: 7, summary: 'Gestion propre des fichiers et ressources (6:20).' },
          { id: 'l3', title: 'Урок #16 – Модули в языке Питон', type: 'video', durationMin: 21, summary: 'Création et usage de modules Python (21:05).' },
        ],
      },
    ],
  },
  {
    slug: 'oop-bases-python',
    title: 'ООП: Классы и Объекты',
    level: 'Avancé',
    duration: '24m',
    description: 'Переходите на новый уровень! Создавайте классы и объекты. Узнайте о конструкторах и инкапсуляции. Начните писать более сложный код.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Создавать классы и объекты',
      'Понимать конструктор __init__',
      'Структурировать данные в классы',
    ],
    prerequisites: ['Parties 1 à 7'],
    formationName: 'Formation Python Russe',
    courseIndex: 7,
    modules: [
      {
        id: 'm1',
        title: 'Objets et construction',
        description: 'Base de la POO en Python.',
        lessons: [
          { id: 'l1', title: 'Урок #17 – Основы ООП. Класс и объект', type: 'video', durationMin: 15, summary: 'Création d’objets et principes OOP (15:00).' },
          { id: 'l2', title: 'Урок #18 – Конструкторы, переопределение', type: 'video', durationMin: 9, summary: 'Constructeurs et redéfinition de méthodes (8:54).' },
        ],
      },
    ],
  },
  {
    slug: 'oop-avance-et-decorateurs',
    title: 'ООП: Наследование и Декораторы',
    level: 'Avancé',
    duration: '27m',
    description: 'Углубитесь в ООП! Изучите наследование, полиморфизм, инкапсуляцию и декораторы. Пишите расширяемый и профессиональный код.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Использовать наследование между классами',
      'Применять полиморфизм и инкапсуляцию',
      'Создавать и использовать декораторы функций',
    ],
    prerequisites: ['Parties 1 à 8'],
    formationName: 'Formation Python Russe',
    courseIndex: 8,
    modules: [
      {
        id: 'm1',
        title: 'POO avancée',
        description: 'Consolidation des concepts orientés objet.',
        lessons: [
          { id: 'l1', title: 'Урок #19 – Наследование, инкапсуляция, полиморфизм', type: 'video', durationMin: 19, summary: 'Héritage, encapsulation et polymorphisme (18:28).' },
          { id: 'l2', title: 'Урок #20 – Декораторы функций', type: 'video', durationMin: 9, summary: 'Décorateurs et logique de wrapping (8:01).' },
        ],
      },
    ],
  },
  {
    slug: 'python-capstone-et-revision',
    title: 'Финальный Проект',
    level: 'Avancé',
    duration: '20m',
    description: 'Завершите всё обучение! Повторите все ключевые концепции и создайте финальный проект, который объединит все ваши знания из 10 курсов.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Повторить все главные темы Python',
      'Создать собственный проект',
      'Подготовиться к следующему уровню программирования',
    ],
    prerequisites: ['Parties 1 à 9'],
    formationName: 'Formation Python Russe',
    courseIndex: 9,
    modules: [
      {
        id: 'm1',
        title: 'Capstone de fin de parcours',
        description: 'Finaliser et ancrer les compétences Python.',
        lessons: [
          { id: 'l1', title: 'Урок #21 – Заключительная часть', type: 'video', durationMin: 2, summary: 'Conclusion du parcours (2:00).' },
          { id: 'l2', title: 'Projet final guidé', type: 'practice', durationMin: 18, summary: 'Créer un mini projet combinant conditions, boucles, fonctions et structures de données.' },
        ],
      },
    ],
  },
];

export function getCourseBySlug(slug: string) {
  return courseCatalog.find((course) => course.slug === slug);
}
