// Shared types for /generator/exercise

export type ExerciseLevel = 'debutant' | 'intermediaire' | 'avance';

export type ExerciseChallengeJson = {
  enonce: string;
  contraintes: string[];
  concepts?: string[];
  hints: string[];
  exemple: string;
  starter_code: string;
};

export type ExerciseTestCase = {
  name: string;
  args_literal: string;
  expected_literal: string;
};

export type ExerciseChallengeTests = {
  mode: 'function';
  function_name: string;
  test_cases: ExerciseTestCase[];
  quality_checks: string[];
};

export type GeneratedExercise = {
  challenge: string;
  challenge_json: ExerciseChallengeJson;
  starter_code: string;
  challenge_tests: ExerciseChallengeTests;
  difficulty: number;
  level: ExerciseLevel;
};

export type ExerciseStats = {
  level: ExerciseLevel;
  difficulty: number;
  totalPoints: number;
  passedCount: number;
  failedCount: number;
  consecutiveWins: number;
  nextLevelPoints: number | null;
  nextLevelPassed: number | null;
};

export type EvalTestResult = {
  name?: string;
  status?: 'passed' | 'failed';
  expected?: string;
  actual?: string;
  error?: string;
};

export type EvalJson = {
  note?: string;
  commentaire?: string;
  test_summary?: {
    passed?: number;
    failed?: number;
    total?: number;
    all_passed?: boolean;
    runtime_error?: string | null;
    runtime_traceback?: string | null;
    exec_time_ms?: number;
  };
  test_results?: EvalTestResult[];
};

export type SubmitResult = {
  score: number;
  passed: boolean;
  evaluation: string;
  evaluationJson: EvalJson | null;
  pointsDelta: number;
  pointsEarned: number;
  stats: ExerciseStats;
  levelUp: boolean;
  difficultyChange: number;
};

export type ExecuteResult = {
  score: number;
  passed: boolean;
  evaluation: string;
  evaluationJson: EvalJson | null;
  validationMs?: number;
};

export type SidebarTab = 'enonce' | 'contraintes' | 'tests' | 'hints';
