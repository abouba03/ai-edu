export type AttemptHistoryItem = {
  at: string;
  note: string;
  status: 'validated' | 'improve';
  focus: string;
};

export type ParsedTestResult = {
  name: string;
  status: 'passed' | 'failed' | 'error';
  input: string;
  expected: string;
  actual: string;
  error?: string;
};

export type ParsedTestSummary = {
  passed: number;
  total: number;
  all_passed: boolean;
  runtime_error: string;
};

export type ParsedChallengeFeedback = {
  promptVersion: string | null;
  note: string | null;
  comment: string;
  consignes: string[];
  idees: string[];
  nextSteps: string[];
  evaluationMode: string | null;
  testSummary: ParsedTestSummary | null;
  testResults: ParsedTestResult[];
  extra: string;
  raw: string;
};

export type CoachGuidance = {
  title: string;
  status: string;
  priorities: string[];
  checklist: string[];
};
