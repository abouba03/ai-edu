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
};

const PYTHON_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa';
const PYTHON_PLAYLIST_ID = 'PLDyJYA6aTY1lPWXBPk0gw6gR8fEtPDGKa';

export const courseCatalog: Course[] = [
  {
    slug: 'python-fondamentaux',
    title: 'Python с нуля — Partie 1: Introduction & Environnement',
    level: 'Débutant',
    duration: '16m',
    description: 'Découvrir Python et configurer un environnement de travail prêt pour les exercices.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Comprendre le parcours global de la formation',
      'Installer un IDE/environnement Python',
      'Exécuter un premier script local',
    ],
    prerequisites: ['Aucun prérequis technique'],
    modules: [
      {
        id: 'm1',
        title: 'Démarrage rapide',
        description: 'Premiers pas et setup complet.',
        lessons: [
          {
            id: 'l1',
            title: 'Урок #1 – Программирование на Питон для начинающих',
            type: 'video',
            durationMin: 6,
            summary: 'Vue d’ensemble du cours Python pour débutants (5:29).',
          },
          {
            id: 'l2',
            title: 'Урок #2 – Установка среды разработки',
            type: 'video',
            durationMin: 12,
            summary: 'Installation de l’environnement de développement (11:06).',
          },
        ],
      },
    ],
  },
  {
    slug: 'operations-et-variables-python',
    title: 'Python с нуля — Partie 2: Opérations & Variables',
    level: 'Débutant',
    duration: '42m',
    description: 'Acquérir les bases calculatoires et les types de données en Python.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Manipuler les opérations fondamentales',
      'Comprendre les variables et types Python',
      'Écrire des expressions correctes',
    ],
    prerequisites: ['Partie 1 terminée'],
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
    title: 'Python с нуля — Partie 3: Conditions & Boucles',
    level: 'Débutant',
    duration: '39m',
    description: 'Contrôler le flux d’exécution avec if/else, for et while.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Écrire des décisions conditionnelles claires',
      'Maîtriser les boucles principales',
      'Éviter les erreurs de contrôle de flux',
    ],
    prerequisites: ['Parties 1 et 2'],
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
    title: 'Python с нуля — Partie 4: Listes & Chaînes',
    level: 'Débutant',
    duration: '50m',
    description: 'Manipuler les listes et chaînes avec indexation et slicing.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Utiliser les méthodes de liste',
      'Maîtriser indices et tranches',
      'Écrire des manipulations de texte robustes',
    ],
    prerequisites: ['Parties 1 à 3'],
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
    title: 'Python с нуля — Partie 5: Tuple, Dict & Set',
    level: 'Intermédiaire',
    duration: '35m',
    description: 'Étudier les structures de données Python au-delà des listes.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Différencier tuple/list selon le besoin',
      'Utiliser les dictionnaires pour mapper des données',
      'Manipuler ensembles et opérations de set',
    ],
    prerequisites: ['Parties 1 à 4'],
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
    title: 'Python с нуля — Partie 6: Fonctions & Fichiers',
    level: 'Intermédiaire',
    duration: '36m',
    description: 'Créer des fonctions et commencer la manipulation de fichiers.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Définir fonctions classiques et lambda',
      'Lire/écrire des fichiers',
      'Préparer des scripts modulaires',
    ],
    prerequisites: ['Parties 1 à 5'],
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
    title: 'Python с нуля — Partie 7: Exceptions, With & Modules',
    level: 'Intermédiaire',
    duration: '38m',
    description: 'Rendre les scripts robustes et modulaires.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Gérer les erreurs avec try/except',
      'Utiliser with ... as pour les ressources',
      'Créer et importer des modules Python',
    ],
    prerequisites: ['Parties 1 à 6'],
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
    title: 'Python с нуля — Partie 8: OOP Fondamentaux',
    level: 'Avancé',
    duration: '24m',
    description: 'Découvrir les classes, objets et constructeurs en Python.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Créer une classe et instancier des objets',
      'Comprendre constructeur et surcharge',
      'Structurer un modèle orienté objet simple',
    ],
    prerequisites: ['Parties 1 à 7'],
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
    title: 'Python с нуля — Partie 9: OOP Avancé & Décorateurs',
    level: 'Avancé',
    duration: '27m',
    description: 'Approfondir héritage, encapsulation, polymorphisme et décorateurs.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Appliquer les 3 piliers OOP',
      'Comprendre les décorateurs de fonctions',
      'Écrire un code OOP plus extensible',
    ],
    prerequisites: ['Parties 1 à 8'],
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
    title: 'Python с нуля — Partie 10: Révision Finale & Capstone',
    level: 'Avancé',
    duration: '20m',
    description: 'Clore la formation avec une synthèse et un mini projet d’application.',
    playlistUrl: PYTHON_PLAYLIST_URL,
    playlistId: PYTHON_PLAYLIST_ID,
    objectives: [
      'Synthétiser les apprentissages des 20 leçons',
      'Construire un mini projet personnel',
      'Préparer la transition vers le niveau suivant',
    ],
    prerequisites: ['Parties 1 à 9'],
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
