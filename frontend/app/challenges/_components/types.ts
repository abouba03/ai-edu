export type ChallengeItem = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  points: number;
  kind: 'code' | 'theory';
  estimatedMinutes: number;
  language: string;
  formationId: string | null;
  formationName: string;
  hints: string[];
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: Array<{ question: string; choices: string[]; answer: string; explanation: string }>;
  updatedAt: string;
  isPublished: boolean;
};

export type ChallengeAttemptRow = {
  id: string;
  challengeId: string | null;
  challengeTitle: string | null;
  challengeKind: string;
  level?: string | null;
  durationSec?: number | null;
  score: number | null;
  passed: boolean;
  evaluation?: unknown;
  createdAt: string;
};
