'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const instructionPages = ['Énoncé', 'Contraintes', 'Tests', 'Terminal', 'Debugger'] as const;

type CodeInstructionPage = (typeof instructionPages)[number];

type ChallengeSections = {
  statement: string;
  constraints: string[];
};

type TestCaseItem = {
  label: string;
  input: string;
  expected: string;
};

type SubmitResult = {
  score: number;
  passed: boolean;
  evaluation: string;
  evaluationJson?: {
    test_summary?: {
      passed?: number;
      total?: number;
      all_passed?: boolean;
      runtime_error?: string;
    };
    test_results?: Array<{
      name?: string;
      status?: string;
      input?: string;
      expected?: string;
      actual?: string;
      error?: string;
    }>;
  } | null;
};

type Props = {
  challengeTitle: string;
  challengeDescription: string | null;
  difficulty: string;
  challengeSections: ChallengeSections;
  testCases: TestCaseItem[];
  code: string;
  estimatedMinutes: number;
  elapsedLabel: string;
  attemptsCount: number;
  activeTabIndex: number;
  onActiveTabIndexChange: (index: number) => void;
  isSubmitting: boolean;
  submitResult: SubmitResult | null;
};

function difficultyToDebugLevel(difficulty: string): 'débutant' | 'intermédiaire' | 'avancé' {
  const normalized = difficulty.toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

export function CodeChallengeSidebar({
  challengeTitle,
  challengeDescription,
  difficulty,
  challengeSections,
  testCases,
  code,
  estimatedMinutes,
  elapsedLabel,
  attemptsCount,
  activeTabIndex,
  onActiveTabIndexChange,
  isSubmitting,
  submitResult,
}: Props) {
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalError, setTerminalError] = useState('');
  const [terminalRunning, setTerminalRunning] = useState(false);

  const [debugLevel, setDebugLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>(difficultyToDebugLevel(difficulty));
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugStep, setDebugStep] = useState(0);
  const [debugResponse, setDebugResponse] = useState('');
  const [debugAnswer, setDebugAnswer] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState('');

  useEffect(() => {
    setDebugLevel(difficultyToDebugLevel(difficulty));
  }, [difficulty]);

  const safeIndex = Math.min(Math.max(activeTabIndex, 0), instructionPages.length - 1);
  const activeTab = instructionPages[safeIndex] as CodeInstructionPage;

  const testSummary = submitResult?.evaluationJson?.test_summary ?? null;
  const testResults = Array.isArray(submitResult?.evaluationJson?.test_results)
    ? submitResult.evaluationJson!.test_results!.filter((item) => Boolean(item))
    : [];

  const consoleInputLines = useMemo(
    () => terminalInput.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    [terminalInput],
  );

  async function runTerminal() {
    if (!code.trim()) {
      setTerminalError('Ajoute du code dans l’éditeur avant de lancer le terminal.');
      setTerminalOutput('');
      return;
    }

    setTerminalRunning(true);
    setTerminalError('');

    try {
      const res = await fetch(`${apiBaseUrl}/execute-console/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          stdin_lines: consoleInputLines,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        stdout?: string;
        error?: string;
        trace?: string;
        detail?: string;
      };

      if (!res.ok) {
        setTerminalOutput('');
        setTerminalError(String(data?.detail || 'Erreur terminal'));
        return;
      }

      setTerminalOutput(String(data.stdout || ''));
      setTerminalError(data.success ? '' : String(data.error || data.trace || 'Erreur terminal'));
    } catch {
      setTerminalOutput('');
      setTerminalError('Terminal indisponible pour le moment.');
    } finally {
      setTerminalRunning(false);
    }
  }

  async function analyzeDebugger() {
    if (!code.trim()) {
      setDebugError('Ajoute du code dans l’éditeur avant de lancer le debugger.');
      return;
    }

    setDebugLoading(true);
    setDebugError('');
    setDebugStep(0);
    setDebugSessionId(null);

    try {
      const res = await fetch(`${apiBaseUrl}/interactive-debug/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          level: debugLevel,
          step: 0,
          student_answer: '',
          session_id: null,
          challenge_description: `${challengeTitle}\n${challengeDescription || ''}`.trim(),
          pedagogy_context: {
            level: debugLevel,
            pedagogicalStyle: 'Debug guidé socratique centré challenge',
            aiTone: 'Coach concis et actionnable',
          },
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        session_id?: string;
        step?: number;
        detail?: string;
      };

      if (!res.ok) {
        setDebugResponse('');
        setDebugError(String(data?.detail || 'Échec du debugger'));
        return;
      }

      setDebugResponse(String(data.response || ''));
      setDebugSessionId(data.session_id ?? null);
      setDebugStep(Number(data.step ?? 1));
      setDebugAnswer('');
    } catch {
      setDebugError('Debugger indisponible pour le moment.');
      setDebugResponse('');
    } finally {
      setDebugLoading(false);
    }
  }

  async function sendDebuggerReply() {
    if (!debugSessionId || !debugAnswer.trim()) return;

    setDebugLoading(true);
    setDebugError('');

    try {
      const res = await fetch(`${apiBaseUrl}/interactive-debug/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          level: debugLevel,
          step: debugStep + 1,
          student_answer: debugAnswer,
          session_id: debugSessionId,
          challenge_description: `${challengeTitle}\n${challengeDescription || ''}`.trim(),
          pedagogy_context: {
            level: debugLevel,
            pedagogicalStyle: 'Debug guidé socratique centré challenge',
            aiTone: 'Coach concis et actionnable',
          },
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        session_id?: string;
        step?: number;
        detail?: string;
      };

      if (!res.ok) {
        setDebugError(String(data?.detail || 'Impossible d’envoyer la réponse'));
        return;
      }

      setDebugResponse(String(data.response || ''));
      setDebugSessionId(data.session_id ?? debugSessionId);
      setDebugStep(Number(data.step ?? (debugStep + 1)));
      setDebugAnswer('');
    } catch {
      setDebugError('Impossible d’envoyer la réponse au debugger.');
    } finally {
      setDebugLoading(false);
    }
  }

  return (
    <aside className="xl:col-span-4 rounded-xl border bg-background p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {instructionPages.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => onActiveTabIndexChange(index)}
            className={`rounded-md border px-2.5 py-1 ${safeIndex === index ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'} ${label === 'Tests' && isSubmitting ? 'animate-pulse border-primary/60' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-3 space-y-2 min-h-[300px]">
        <p className="text-[11px] text-muted-foreground">Page {safeIndex + 1}/{instructionPages.length}</p>

        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {activeTab === 'Énoncé' && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border bg-background p-2 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Objectif</p>
                <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">{challengeSections.statement}</p>
              </div>
            </div>
          )}

          {activeTab === 'Contraintes' && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border bg-background p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contraintes</p>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{challengeSections.constraints.length} règles</span>
                </div>

                <div className="grid grid-cols-1 gap-1">
                  {challengeSections.constraints.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-sm border bg-card px-2 py-1.5">
                      <p className="text-[11px] leading-relaxed text-foreground">{index + 1}. {item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Tests' && (
            <div className="space-y-2 text-sm">
              {isSubmitting && (
                <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 animate-pulse">
                  <p className="text-[11px] uppercase tracking-wide text-primary font-semibold">Validation en cours…</p>
                </div>
              )}

              <div className="rounded-md border bg-background p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cas de validation</p>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{testCases.length} cas</span>
                </div>

                {testCases.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1">
                    {testCases.map((test, index) => (
                      <div key={`${test.label}-${index}`} className="rounded-sm border bg-card px-2 py-1.5 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold truncate">{test.label || `Cas ${index + 1}`}</p>
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">#{index + 1}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">Entrée: {test.input}</p>
                        <p className="text-[10px] text-muted-foreground truncate">Attendu: {test.expected}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun test renseigné pour ce challenge.</p>
                )}
              </div>

              <div className="rounded-md border bg-background p-2 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Résultats</p>

                {!submitResult ? (
                  <p className="text-xs text-muted-foreground">Soumets ton code pour voir les résultats.</p>
                ) : (
                  <>
                    <div className={`rounded-sm border px-2 py-1.5 text-[11px] font-medium ${submitResult.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
                      Score: {submitResult.score}/100 {submitResult.passed ? '✅' : '❌'}
                    </div>

                    {testSummary && (
                      <div className={`rounded-sm border px-2 py-1.5 text-[11px] ${Number(testSummary.passed ?? 0) === Number(testSummary.total ?? 0) && Number(testSummary.total ?? 0) > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
                        {Number(testSummary.passed ?? 0)}/{Number(testSummary.total ?? 0)} validés
                        {testSummary.runtime_error ? ` · ${testSummary.runtime_error}` : ''}
                      </div>
                    )}

                    {testResults.length > 0 && (
                      <div className="grid grid-cols-1 gap-1">
                        {testResults.slice(0, 8).map((item, index) => {
                          const status = String(item.status || '').toLowerCase();
                          const isPass = status === 'passed';
                          return (
                            <div key={`${item.name || 'test'}-${index}`} className={`rounded-sm border px-2 py-1.5 ${isPass ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-[11px] font-semibold truncate ${isPass ? 'text-emerald-800' : 'text-rose-800'}`}>
                                  {item.name || `Test ${index + 1}`}
                                </p>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${isPass ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800'}`}>
                                  {isPass ? 'ok' : 'ko'}
                                </span>
                              </div>
                              {item.expected && <p className={`text-[10px] truncate ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>Attendu: {item.expected}</p>}
                              {item.actual && <p className={`text-[10px] truncate ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>Obtenu: {item.actual}</p>}
                              {item.error && <p className="text-[10px] truncate text-rose-700">Erreur: {item.error}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Terminal' && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border bg-background p-2 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Terminal Python</p>
                <p className="text-[11px] text-muted-foreground">Entrées console (`input`) : 1 ligne = 1 valeur.</p>
                <textarea
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  className="w-full min-h-20 rounded-md border bg-card px-2 py-1.5 text-xs font-mono"
                  placeholder={'ex:\nAlice\n42'}
                />
                <Button className="h-8 text-xs" onClick={runTerminal} disabled={terminalRunning || !code.trim()}>
                  {terminalRunning ? 'Exécution...' : 'Exécuter le code'}
                </Button>

                {terminalError && <p className="text-xs text-destructive whitespace-pre-wrap">{terminalError}</p>}

                <div className="rounded-md border bg-card p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sortie terminal</p>
                  <pre className="text-xs whitespace-pre-wrap max-h-44 overflow-y-auto">{terminalOutput || 'Aucune sortie.'}</pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Debugger' && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border bg-background p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Debugger guidé</p>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">Étape {debugStep}</span>
                </div>

                <select
                  value={debugLevel}
                  onChange={(event) => setDebugLevel(event.target.value as 'débutant' | 'intermédiaire' | 'avancé')}
                  className="w-full rounded-md border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="débutant">Débutant</option>
                  <option value="intermédiaire">Intermédiaire</option>
                  <option value="avancé">Avancé</option>
                </select>

                <Button className="h-8 text-xs" onClick={analyzeDebugger} disabled={debugLoading || !code.trim()}>
                  {debugLoading ? 'Analyse...' : 'Analyser le code'}
                </Button>

                {debugError && <p className="text-xs text-destructive">{debugError}</p>}

                <div className="rounded-md border bg-card p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Réponse IA</p>
                  <pre className="text-xs whitespace-pre-wrap max-h-44 overflow-y-auto">{debugResponse || 'Aucune analyse pour le moment.'}</pre>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={debugAnswer}
                    onChange={(event) => setDebugAnswer(event.target.value)}
                    className="w-full rounded-md border bg-card px-2 py-1.5 text-xs"
                    placeholder="Ta réponse au debugger..."
                  />
                  <Button
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={sendDebuggerReply}
                    disabled={debugLoading || !debugSessionId || !debugAnswer.trim()}
                  >
                    Envoyer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Durée estimée</span>
          <span className="rounded-md border px-2 py-1">{estimatedMinutes} min</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Chrono session</span>
          <span className="rounded-md border px-2 py-1 font-mono">{elapsedLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Tentatives</span>
          <span className="rounded-md border px-2 py-1">{attemptsCount}</span>
        </div>
      </div>
    </aside>
  );
}
