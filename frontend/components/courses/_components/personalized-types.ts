export type Question = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

export type SequenceStep = {
  step: string;
  reason: string;
  cta: string;
  href: string;
};

export type AdaptiveLevel = 'débutant' | 'intermédiaire' | 'avancé';

export type VideoResource = {
  sourceUrl: string;
  embedUrl: string;
};
