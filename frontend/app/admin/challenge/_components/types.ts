export type TheoryQuestionFormat = 'qcm' | 'true_false' | 'free_text';

export type ChallengeForm = {
  title: string;
  description: string;
  difficulty: 'débutant' | 'intermédiaire' | 'avancé';
  kind: 'code' | 'theory';
  theoryFormat: 'mixed';
  theoryQuestionCount: number;
  estimatedMinutes: number;
  points: number;
  language: string;
  formationId: string;
  formationName: string;
  tagsText: string;
  hint1: string;
  hint2: string;
  starterCode: string;
  case1Input: string;
  case1Expected: string;
  case2Input: string;
  case2Expected: string;
  case3Input: string;
  case3Expected: string;
  isPublished: boolean;
};

export type TheoryQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
  format: TheoryQuestionFormat;
};

export type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  points: number;
  language: string;
  kind: 'code' | 'theory';
  theoryFormat: 'qcm' | 'true_false' | 'free_text' | 'mixed' | null;
  theoryQuestionCount: number;
  estimatedMinutes: number;
  formationId: string | null;
  formationName: string;
  tags: string[];
  hints: string[];
  starterCode: string;
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: TheoryQuestion[];
  generatedPrompt: string;
  generationSource: 'generate-challenge' | 'generate-quiz' | null;
  isPublished: boolean;
  updatedAt: string;
};

export type FormationOption = {
  id: string;
  name: string;
};

export type ChallengePayload = {
  title: string;
  description: string;
  difficulty: 'débutant' | 'intermédiaire' | 'avancé';
  kind: 'code' | 'theory';
  theoryFormat: 'mixed' | null;
  theoryQuestionCount: number;
  estimatedMinutes: number;
  points: number;
  language: string;
  formationId: string | null;
  formationName: string;
  tags: string[];
  hints: string[];
  starterCode: string;
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: TheoryQuestion[];
  generatedPrompt: string;
  generationSource: 'generate-challenge' | 'generate-quiz';
  isPublished: boolean;
};