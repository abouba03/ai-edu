export type ConsoleLine = {
  kind: 'meta' | 'stdin' | 'stdout' | 'stderr';
  text: string;
};

export type LeftPanelTab = 'enonce' | 'terminal' | 'chat';

export type PlotPoint = {
  x: number;
  y: number;
};

export type PlotSeries = {
  name: string;
  points: PlotPoint[];
};

export type PlotPayload = {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  series: PlotSeries[];
};

export type PerfPoint = {
  n: number;
  timeMs: number;
};

export type PerfPayload = {
  title?: string;
  points: PerfPoint[];
};

export type ChallengeTests = {
  mode?: string;
  function_name?: string;
  test_cases?: Array<{
    name?: string;
    args_literal?: string;
    expected_literal?: string;
    constraint?: string;
    stdin_lines?: string[];
    expected_stdout?: string;
  }>;
  quality_checks?: string[];
};

export type ChallengeScenarioJson = {
  enonce?: string;
  contraintes?: string[];
  hints?: string[];
  exemple?: string;
  starter_code?: string;
};

export type EvaluationJson = {
  note?: string;
  commentaire?: string;
  evaluation_mode?: string;
  test_summary?: {
    passed?: number;
    total?: number;
    all_passed?: boolean;
    runtime_error?: string;
  };
  test_results?: Array<{
    name?: string;
    status?: 'passed' | 'failed' | 'error';
    input?: string;
    expected?: string;
    actual?: string;
    error?: string;
  }>;
};