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
    description: 'Сделать хотя бы 1 попытку.',
    minAttempts: 1,
    minPassRate: 0,
  },
  {
    key: 'consistent',
    label: 'Постоянный',
    description: 'Сделать 5 попыток с результатом не менее 50%.',
    minAttempts: 5,
    minPassRate: 50,
  },
  {
    key: 'expert',
    label: 'Эксперт',
    description: 'Сделать 10 попыток с результатом не менее 70%.',
    minAttempts: 10,
    minPassRate: 70,
  },
];
