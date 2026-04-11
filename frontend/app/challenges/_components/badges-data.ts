export type BadgeRule = {
  key: string;
  label: string;
  description: string;
  minAttempts: number;
  minPassRate: number;
};

export const BADGE_RULES: BadgeRule[] = [
  {
    key: 'starter',
    label: 'Starter',
    description: 'Faire au moins 1 tentative.',
    minAttempts: 1,
    minPassRate: 0,
  },
  {
    key: 'consistent',
    label: 'Régulier',
    description: 'Faire 5 tentatives avec au moins 50% de réussite.',
    minAttempts: 5,
    minPassRate: 50,
  },
  {
    key: 'expert',
    label: 'Expert',
    description: 'Faire 10 tentatives avec au moins 70% de réussite.',
    minAttempts: 10,
    minPassRate: 70,
  },
];
