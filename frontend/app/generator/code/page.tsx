'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import Editor, { loader } from '@monaco-editor/react';
import { ArrowLeft, Code2, Loader2, PlayCircle, Sparkles, Wand2 } from 'lucide-react';
import { trackEvent } from '@/lib/event-tracker';
import GeneratorSidePanel from './_components/GeneratorSidePanel';
import type { ChallengeScenarioJson, ChallengeTests, ConsoleLine, EvaluationJson, LeftPanelTab, PerfPayload, PlotPayload, PlotPoint, PlotSeries } from './_components/types';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002';
const MAX_GENERATE_PROMPT_CHARS = 12000;
const API_BASE_CANDIDATES = [apiBaseUrl, 'http://127.0.0.1:8002', 'http://localhost:8002', 'http://127.0.0.1:8000', 'http://localhost:8000'];
const REQUEST_TIMEOUT_MS = {
  generateChallenge: 30000,
  generateCode: 45000,
  submitChallenge: 25000,
};
const FALLBACK_DEAD_BASE_TIMEOUT_MS = 3500;
let cachedApiBase: string | null = null;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function buildApiBaseCandidates(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of API_BASE_CANDIDATES) {
    const normalized = normalizeBaseUrl(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

function buildOrderedApiCandidates(preferredBase?: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushCandidate = (raw: string | null | undefined) => {
    const normalized = normalizeBaseUrl(String(raw || ''));
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  pushCandidate(preferredBase);
  pushCandidate(cachedApiBase);
  for (const base of buildApiBaseCandidates()) {
    pushCandidate(base);
  }

  return ordered;
}

function toWsBase(httpBase: string): string {
  return normalizeBaseUrl(httpBase)
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
}

function buildWsCandidates(primaryBase: string): string[] {
  const baseCandidates = [normalizeBaseUrl(primaryBase), ...buildApiBaseCandidates()];
  const pathCandidates = ['/ws/console', '/ws/console/'];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const base of baseCandidates) {
    const wsBase = toWsBase(base);
    for (const path of pathCandidates) {
      const url = `${wsBase}${path}`;
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

async function postJsonWithFallback<T>(
  path: string,
  payload: unknown,
  timeoutMs: number,
  preferredBase?: string,
): Promise<{ data: T; baseUrl: string }> {
  const candidates = buildOrderedApiCandidates(preferredBase);
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const base = candidates[i];
    const requestTimeout = i === 0 ? timeoutMs : Math.min(timeoutMs, FALLBACK_DEAD_BASE_TIMEOUT_MS);
    try {
      const response = await axios.post<T>(`${base}${path}`, payload, { timeout: requestTimeout });
      cachedApiBase = base;
      return { data: response.data, baseUrl: base };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        // If a reachable backend returns a request error, don't waste time retrying all ports.
        if (status >= 400 && status < 500 && status !== 404 && status !== 408) {
          throw err;
        }
      }
      lastError = err;
    }
  }

  throw lastError ?? new Error('API indisponible');
}

function clampPrompt(raw: string): string {
  const normalized = raw.trim();
  if (normalized.length <= MAX_GENERATE_PROMPT_CHARS) return normalized;
  const suffix = `\n\n[Prompt tronque automatiquement a ${MAX_GENERATE_PROMPT_CHARS} caracteres]`;
  return `${normalized.slice(0, MAX_GENERATE_PROMPT_CHARS - suffix.length)}${suffix}`;
}

function extractApiErrorMessage(err: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.msg === 'string') {
        return first.msg;
      }
    }

    if (!err.response) {
      return `Impossible de joindre l API (${apiBaseUrl}). Verifie que le backend ecoute sur ce port.`;
    }
  }

  return fallbackMessage;
}

function extractTopic(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Exercice Python genere';
  return cleaned.length > 80 ? `${cleaned.slice(0, 80)}...` : cleaned;
}

function extractEnonceOnly(text: string): string {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';

  // Keep only the statement and remove generated sections when they are inlined.
  const markers = [
    /\n\s*contraintes?\s*:/i,
    /\n\s*indices?\s*:/i,
    /\n\s*exemple\s*:/i,
    /\n\s*tests?\s*:/i,
    /\n\s*hints?\s*:/i,
  ];

  let end = cleaned.length;
  for (const marker of markers) {
    const match = marker.exec(cleaned);
    if (match && typeof match.index === 'number') {
      end = Math.min(end, match.index);
    }
  }

  return cleaned
    .slice(0, end)
    .replace(/^\s*exercice\s*:\s*/i, '')
    .replace(/^\s*enonce\s*:\s*/i, '')
    .trim();
}

function toNumericPoints(xValues: unknown, yValues: unknown): PlotPoint[] {
  if (!Array.isArray(yValues)) return [];
  const yNums = yValues.map((value) => Number(value));
  if (yNums.some((value) => !Number.isFinite(value))) return [];

  if (Array.isArray(xValues) && xValues.length === yNums.length) {
    const xNums = xValues.map((value) => Number(value));
    if (xNums.some((value) => !Number.isFinite(value))) return [];
    return xNums.map((x, index) => ({ x, y: yNums[index] }));
  }

  return yNums.map((y, index) => ({ x: index, y }));
}

function normalizePlotPayload(raw: unknown): PlotPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const explicitSeries = Array.isArray(data.series)
    ? (data.series as Array<Record<string, unknown>>)
      .map((item, index): PlotSeries | null => {
        if (!item || typeof item !== 'object') return null;
        const name = String(item.name ?? `serie-${index + 1}`);

        let points: PlotPoint[] = [];
        if (Array.isArray(item.points)) {
          points = (item.points as Array<Record<string, unknown>>)
            .map((point) => {
              const x = Number(point?.x);
              const y = Number(point?.y);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              return { x, y };
            })
            .filter((point): point is PlotPoint => point !== null);
        } else {
          points = toNumericPoints(item.x, item.y);
        }

        if (points.length === 0) return null;
        return { name, points };
      })
      .filter((series): series is PlotSeries => series !== null)
    : [];

  const fallbackPoints = toNumericPoints(data.x, data.y);
  const series = explicitSeries.length > 0
    ? explicitSeries
    : (fallbackPoints.length > 0 ? [{ name: 'serie-1', points: fallbackPoints }] : []);

  if (series.length === 0) return null;

  return {
    title: typeof data.title === 'string' ? data.title : undefined,
    xLabel: typeof data.xLabel === 'string' ? data.xLabel : undefined,
    yLabel: typeof data.yLabel === 'string' ? data.yLabel : undefined,
    series,
  };
}

function extractPlotPayloadFromConsole(lines: ConsoleLine[]): PlotPayload | null {
  const stdout = lines
    .filter((line) => line.kind === 'stdout')
    .map((line) => line.text)
    .join('');

  if (!stdout.trim()) return null;

  const startToken = 'PLOT_JSON_START';
  const endToken = 'PLOT_JSON_END';
  const startIndex = stdout.lastIndexOf(startToken);
  if (startIndex >= 0) {
    const endIndex = stdout.indexOf(endToken, startIndex + startToken.length);
    if (endIndex > startIndex) {
      const rawPayload = stdout.slice(startIndex + startToken.length, endIndex).trim();
      try {
        return normalizePlotPayload(JSON.parse(rawPayload));
      } catch {
        return null;
      }
    }
  }

  const marker = 'PLOT_JSON:';
  const candidates = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(marker));

  if (candidates.length === 0) return null;

  const rawLinePayload = candidates[candidates.length - 1].slice(marker.length).trim();
  if (!rawLinePayload) return null;

  try {
    return normalizePlotPayload(JSON.parse(rawLinePayload));
  } catch {
    return null;
  }
}

function normalizePerfPayload(raw: unknown): PerfPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.points)) return null;

  const points = (data.points as Array<Record<string, unknown>>)
    .map((point) => {
      const n = Number(point?.n);
      const timeMs = Number(point?.timeMs);
      if (!Number.isFinite(n) || !Number.isFinite(timeMs)) return null;
      return { n, timeMs };
    })
    .filter((point): point is { n: number; timeMs: number } => point !== null);

  if (points.length === 0) return null;

  return {
    title: typeof data.title === 'string' ? data.title : undefined,
    points,
  };
}

function extractPerfPayloadFromConsole(lines: ConsoleLine[]): PerfPayload | null {
  const stdout = lines
    .filter((line) => line.kind === 'stdout')
    .map((line) => line.text)
    .join('');

  if (!stdout.trim()) return null;

  const marker = 'PERF_JSON:';
  const candidates = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(marker));

  if (candidates.length === 0) return null;

  const payload = candidates[candidates.length - 1].slice(marker.length).trim();
  if (!payload) return null;

  try {
    return normalizePerfPayload(JSON.parse(payload));
  } catch {
    return null;
  }
}

function extractLatestRuntimeSeconds(lines: ConsoleLine[]): number | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.kind !== 'meta') continue;

    const match = line.text.match(/Temps d'execution\s*:\s*([0-9]+(?:\.[0-9]+)?)s/i);
    if (!match) continue;

    const value = Number(match[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

export default function GeneratorCodePage() {
  const [problemText, setProblemText] = useState('');
  const [level, setLevel] = useState<'debutant' | 'intermediaire' | 'avance'>('intermediaire');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  const [challenge, setChallenge] = useState('');
  const [challengeJson, setChallengeJson] = useState<ChallengeScenarioJson | null>(null);
  const [challengeTests, setChallengeTests] = useState<ChallengeTests | null>(null);
  const [starterCode, setStarterCode] = useState('');
  const [generatedExplanation, setGeneratedExplanation] = useState('');
  const [solutionCode, setSolutionCode] = useState('');

  // ── Console / terminal state ──────────────────────────────────────────
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  const [evaluationJson, setEvaluationJson] = useState<EvaluationJson | null>(null);
  const [error, setError] = useState('');
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [runningConsole, setRunningConsole] = useState(false);
  const [validating, setValidating] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('enonce');
  const [plotPayload, setPlotPayload] = useState<PlotPayload | null>(null);
  const [perfPayload, setPerfPayload] = useState<PerfPayload | null>(null);
  const [activeApiBase, setActiveApiBase] = useState(normalizeBaseUrl(apiBaseUrl));
  const [generationPhase, setGenerationPhase] = useState('');
  const [activeWsUrl, setActiveWsUrl] = useState('');
  const activeApiBaseRef = useRef(normalizeBaseUrl(apiBaseUrl));

  const constraints = challengeJson?.contraintes ?? [];

  useEffect(() => {
    activeApiBaseRef.current = activeApiBase;
  }, [activeApiBase]);

  // Auto-scroll terminal on new output
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [consoleLines]);

  useEffect(() => {
    const extracted = extractPlotPayloadFromConsole(consoleLines);

    if (!extracted) {
      if (plotPayload) {
        setPlotPayload(null);
      }
      return;
    }

    const previous = plotPayload ? JSON.stringify(plotPayload) : '';
    const next = JSON.stringify(extracted);
    if (previous !== next) {
      setPlotPayload(extracted);
    }
  }, [consoleLines, plotPayload]);

  useEffect(() => {
    const extracted = extractPerfPayloadFromConsole(consoleLines);

    if (!extracted) {
      if (perfPayload) {
        setPerfPayload(null);
      }
      return;
    }

    const previous = perfPayload ? JSON.stringify(perfPayload) : '';
    const next = JSON.stringify(extracted);
    if (previous !== next) {
      setPerfPayload(extracted);
    }
  }, [consoleLines, perfPayload]);

  const enonceText = useMemo(() => {
    if (challengeJson?.enonce?.trim()) {
      const extracted = extractEnonceOnly(challengeJson.enonce);
      if (extracted) return extracted;
    }
    if (challenge.trim()) {
      const extracted = extractEnonceOnly(challenge);
      if (extracted) return extracted;
    }
    return 'Genere un mini-challenge pour afficher l enonce ici.';
  }, [challenge, challengeJson]);

  async function evaluateCandidateCode(candidateCode: string): Promise<EvaluationJson | null> {
    if (!challenge.trim() || !candidateCode.trim()) return null;

    try {
      const { data, baseUrl } = await postJsonWithFallback<{ evaluation_json?: EvaluationJson }>('/submit-challenge/', {
        challenge_description: challenge,
        student_code: candidateCode,
        challenge_tests: challengeTests,
        pedagogy_context: {
          pedagogicalStyle: 'Validation sur tests et feedback actionnable',
          aiTone: 'Coach precis',
          targetAudience: 'Etudiant',
          courseTitle: extractTopic(problemText),
          responseLanguage: 'francais simple',
        },
      }, REQUEST_TIMEOUT_MS.submitChallenge, activeApiBaseRef.current);

      setActiveApiBase(baseUrl);

      return (data?.evaluation_json && typeof data.evaluation_json === 'object')
        ? (data.evaluation_json as EvaluationJson)
        : null;
    } catch {
      return null;
    }
  }

  async function generateResolvedCode(
    nextChallenge: string,
    nextStarterCode: string,
    nextTests: ChallengeTests | null,
    withTracking = true,
  ) {
    if (!nextChallenge.trim() || !nextStarterCode.trim()) return;

    setLoadingSolution(true);
    setGenerationPhase('Generation du code IA...');

    if (withTracking) {
      await trackEvent({
        action: 'generator_code_generate_solution',
        feature: 'generator_code_page',
        status: 'start',
        metadata: { level, hasTests: Boolean(nextTests?.test_cases?.length) },
      });
    }

    try {
      const basePrompt = clampPrompt([
        'Tu es un expert Python et un tuteur academique.',
        'Ta mission: produire une solution correcte, claire et executable a l exercice de l eleve.',
        '',
        'Regles obligatoires:',
        '1) Respecte exactement la demande de l enonce.',
        '2) Si le probleme contient plusieurs etapes, decompose la solution en blocs/fonctions logiques et relie-les proprement.',
        '3) Priorise une solution simple, lisible et efficace (evite le code inutile).',
        '4) Gere les cas limites et erreurs courantes (entrees vides, types inattendus, valeurs invalides).',
        '5) Respecte strictement la signature/template fourni.',
        '6) N utilise pas de bibliotheque externe sauf si explicitement demandee.',
        '7) Le code doit etre pret a executer immediatement.',
        '8) Si des tests sont fournis, la solution doit les satisfaire.',
        '',
        'Format de sortie:',
        '- Retourne uniquement du code Python final (pas d explications hors code).',
        '',
        'Donnees d entree:',
        'ENONCE:',
        nextChallenge,
        '',
        'TEMPLATE (si fourni):',
        nextStarterCode,
        '',
        'TESTS/CONTRAINTES (si fournis):',
        JSON.stringify(nextTests || {}),
      ].join('\n'));

      const { data: firstGenerateData, baseUrl: generateBase } = await postJsonWithFallback<{ code?: string; explanation?: string }>('/generate/', {
        prompt: basePrompt,
        pedagogy_context: {
          pedagogicalStyle: 'Solution complete testable et lisible',
          aiTone: 'Coach technique precis',
          targetAudience: 'Etudiant',
          responseLanguage: 'francais simple',
        },
      }, REQUEST_TIMEOUT_MS.generateCode, activeApiBaseRef.current);

      setActiveApiBase(generateBase);

      let bestCode = String(firstGenerateData?.code ?? '').trim() || '# Aucune reponse code recue';
      let bestExplanation = String(firstGenerateData?.explanation ?? '').trim();
      let bestEvaluation = await evaluateCandidateCode(bestCode);

      const firstPassed = bestEvaluation?.test_summary?.passed ?? 0;
      const total = bestEvaluation?.test_summary?.total ?? 0;
      const needsFix = Boolean(total > 0 && !bestEvaluation?.test_summary?.all_passed);

      if (needsFix) {
        setGenerationPhase('Correction automatique basee sur les tests...');
        const failingTests = (bestEvaluation?.test_results ?? [])
          .filter((test) => test.status !== 'passed')
          .map((test) => {
            const name = test.name || 'test';
            const expected = test.expected || 'N/A';
            const actual = test.actual || test.error || 'N/A';
            return `${name} | expected=${expected} | actual=${actual}`;
          })
          .join('\n');

        const previousCodeForFix = bestCode.length > 1200
          ? `${bestCode.slice(0, 1200)}\n# ... code tronque ...`
          : bestCode;

        const failingTestsForFix = (failingTests || 'Aucun detail').length > 1200
          ? `${(failingTests || 'Aucun detail').slice(0, 1200)}\n... details tronques ...`
          : (failingTests || 'Aucun detail');

        const fixPrompt = clampPrompt([
          basePrompt,
          '',
          'Ton precedent code ne passe pas tous les tests. Corrige-le.',
          'Objectif obligatoire: 100% des tests passes.',
          '',
          'Code precedent:',
          previousCodeForFix,
          '',
          'Tests en echec:',
          failingTestsForFix,
          '',
          'Retourne uniquement le code Python final corrige.',
        ].join('\n'));

        const { data: retryData, baseUrl: retryBase } = await postJsonWithFallback<{ code?: string; explanation?: string }>('/generate/', {
          prompt: fixPrompt,
          pedagogy_context: {
            pedagogicalStyle: 'Correction ciblee sur tests en echec',
            aiTone: 'Coach technique precis',
            targetAudience: 'Etudiant',
            responseLanguage: 'francais simple',
          },
        }, REQUEST_TIMEOUT_MS.generateCode, activeApiBaseRef.current);

        setActiveApiBase(retryBase);

        const retryCode = String(retryData?.code ?? '').trim();
        const retryExplanation = String(retryData?.explanation ?? '').trim();

        if (retryCode) {
          const retryEvaluation = await evaluateCandidateCode(retryCode);
          const retryPassed = retryEvaluation?.test_summary?.passed ?? 0;
          const retryAllPassed = Boolean(retryEvaluation?.test_summary?.all_passed);

          if (retryAllPassed || retryPassed >= firstPassed) {
            bestCode = retryCode;
            bestExplanation = retryExplanation || bestExplanation;
            bestEvaluation = retryEvaluation;
          }
        }
      }

      setSolutionCode(bestCode);
      setGeneratedExplanation(bestExplanation);
      if (bestEvaluation) {
        setEvaluationJson(bestEvaluation);
      }

      if (withTracking) {
        await trackEvent({
          action: 'generator_code_generate_solution',
          feature: 'generator_code_page',
          status: 'success',
          metadata: {
            codeLen: bestCode.length,
            passed: bestEvaluation?.test_summary?.passed ?? 0,
            total: bestEvaluation?.test_summary?.total ?? 0,
            allPassed: Boolean(bestEvaluation?.test_summary?.all_passed),
          },
        });
      }
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Erreur pendant la generation de la solution.'));
      if (withTracking) {
        await trackEvent({
          action: 'generator_code_generate_solution',
          feature: 'generator_code_page',
          status: 'error',
        });
      }
    } finally {
      setLoadingSolution(false);
      setGenerationPhase('');
    }
  }

  async function handleGenerateScenario() {
    const normalized = problemText.trim();
    if (!normalized || loadingScenario) return false;

    setLoadingScenario(true);
    setGenerationPhase('Generation du scenario...');
    setError('');
    setChallenge('');
    setChallengeJson(null);
    setChallengeTests(null);
    setStarterCode('');
    setSolutionCode('');
    setGeneratedExplanation('');
    setEvaluationJson(null);
    setConsoleLines([]);
    setPlotPayload(null);
    setPerfPayload(null);

    await trackEvent({
      action: 'generator_code_build_scenario',
      feature: 'generator_code_page',
      status: 'start',
      metadata: { problemLen: normalized.length, level },
    });

    try {
      const { data, baseUrl } = await postJsonWithFallback<{
        challenge?: string;
        challenge_json?: ChallengeScenarioJson;
        starter_code?: string;
        challenge_tests?: ChallengeTests;
      }>('/generate-challenge/', {
        level,
        language: 'Python',
        challenge_topic: extractTopic(normalized),
        course_description: normalized,
        pedagogy_context: {
          pedagogicalStyle: 'Mini challenge progressif avec evaluation par tests',
          aiTone: 'Coach clair et exigeant',
          targetAudience: 'Etudiant',
          courseTitle: extractTopic(normalized),
          courseDescription: normalized,
          responseLanguage: 'francais simple',
        },
      }, REQUEST_TIMEOUT_MS.generateChallenge, activeApiBaseRef.current);

      setActiveApiBase(baseUrl);

      const nextChallenge = String(data?.challenge ?? '').trim();
      const nextJson = data?.challenge_json && typeof data.challenge_json === 'object'
        ? (data.challenge_json as ChallengeScenarioJson)
        : null;
      const nextStarter = String(data?.starter_code ?? '').trim()
        || String(nextJson?.starter_code ?? '').trim();
      const nextTests = data?.challenge_tests && typeof data.challenge_tests === 'object'
        ? (data.challenge_tests as ChallengeTests)
        : null;

      setChallenge(nextChallenge || 'Enonce non disponible.');
      setChallengeJson(nextJson);
      setStarterCode(nextStarter || '# starter code non fourni');
      setChallengeTests(nextTests);
      setLeftPanelTab('enonce');
      setConsoleLines([]);
      setTerminalInput('');
      setPlotPayload(null);
      setPerfPayload(null);
      setSolutionCode('# Generation de la solution en cours...');
      void generateResolvedCode(nextChallenge || '', nextStarter || '', nextTests, false);

      await trackEvent({
        action: 'generator_code_build_scenario',
        feature: 'generator_code_page',
        status: 'success',
        metadata: {
          level,
          testsCount: nextTests?.test_cases?.length ?? 0,
          mode: nextTests?.mode ?? 'unknown',
        },
      });

      return true;
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Erreur de generation du scenario.'));
      setGenerationPhase('');
      await trackEvent({
        action: 'generator_code_build_scenario',
        feature: 'generator_code_page',
        status: 'error',
      });
      return false;
    } finally {
      setLoadingScenario(false);
    }
  }

  async function handleGenerateFromModal() {
    const success = await handleGenerateScenario();
    if (success) {
      setIsPromptModalOpen(false);
    }
  }

  function stopExecution() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRunningConsole(false);
  }

  async function handleRunConsole() {
    if (!solutionCode.trim() || runningConsole) return;

    // Close any previous session
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRunningConsole(true);
    setLeftPanelTab('terminal');
    setConsoleLines([{ kind: 'meta', text: '$ python solution.py\n' }]);
    setTerminalInput('');
    setPlotPayload(null);
    setPerfPayload(null);

    const wsCandidates = buildWsCandidates(activeApiBase);
    let attemptIndex = 0;

    const connectNext = () => {
      if (attemptIndex >= wsCandidates.length) {
        setLeftPanelTab('terminal');
        setConsoleLines((prev) => [
          ...prev,
          {
            kind: 'stderr',
            text: `Erreur WebSocket — aucun endpoint valide. Tentatives: ${wsCandidates.join(' | ')}`,
          },
        ]);
        setRunningConsole(false);
        wsRef.current = null;
        setActiveWsUrl('');
        return;
      }

      const wsUrl = wsCandidates[attemptIndex];
      attemptIndex += 1;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setActiveWsUrl(wsUrl);
      let opened = false;

      ws.onopen = () => {
        opened = true;
        ws.send(JSON.stringify({ code: solutionCode }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: string;
            code?: number;
          };

          if (msg.type === 'stdout' || msg.type === 'stderr') {
            const chunk = msg.data ?? '';
            setConsoleLines((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === msg.type) {
                return [...prev.slice(0, -1), { kind: last.kind, text: last.text + chunk }];
              }
              return [...prev, { kind: msg.type as 'stdout' | 'stderr', text: chunk }];
            });
          } else if (msg.type === 'meta') {
            setConsoleLines((prev) => [
              ...prev,
              { kind: 'meta', text: (msg.data ?? '') + '\n' },
            ]);
          } else if (msg.type === 'exit') {
            const rc = msg.code ?? 0;
            setConsoleLines((prev) => [
              ...prev,
              { kind: 'meta', text: `Process finished with exit code ${rc}\n` },
            ]);
            setRunningConsole(false);
            wsRef.current = null;
            setActiveWsUrl('');
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!opened) {
          connectNext();
          return;
        }
        setRunningConsole(false);
        wsRef.current = null;
        setActiveWsUrl('');
      };
    };

    connectNext();
  }

  function handleTerminalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const line = terminalInput;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // Echo back in the terminal
    setConsoleLines((prev) => [...prev, { kind: 'stdin', text: `${line}\n` }]);
    wsRef.current.send(JSON.stringify({ type: 'stdin', data: line }));
    setTerminalInput('');
  }

  function handleApplyFromChat(code: string, mode: 'replace' | 'append') {
    if (mode === 'replace') {
      setSolutionCode(code.trim());
      return;
    }

    setSolutionCode((prev) => {
      const current = prev.trim();
      const incoming = code.trim();
      if (!incoming) return prev;
      if (!current) return incoming;
      return `${current}\n\n${incoming}`;
    });
  }

  async function handleValidate(persistProgress = true) {
    if (!challenge.trim() || !solutionCode.trim() || validating) return;

    setValidating(true);
    setError('');

    await trackEvent({
      action: 'generator_code_validate',
      feature: 'generator_code_page',
      status: 'start',
      metadata: { testsCount: challengeTests?.test_cases?.length ?? 0 },
    });

    try {
      const { data, baseUrl } = await postJsonWithFallback<{ evaluation?: string; evaluation_json?: EvaluationJson }>('/submit-challenge/', {
        challenge_description: challenge,
        student_code: solutionCode,
        challenge_tests: challengeTests,
        pedagogy_context: {
          pedagogicalStyle: 'Validation sur tests et feedback actionnable',
          aiTone: 'Coach precis',
          targetAudience: 'Etudiant',
          courseTitle: extractTopic(problemText),
          responseLanguage: 'francais simple',
        },
      }, REQUEST_TIMEOUT_MS.submitChallenge, activeApiBaseRef.current);

      setActiveApiBase(baseUrl);

      const raw = String(data?.evaluation ?? '').trim();
      const parsed = (data?.evaluation_json && typeof data.evaluation_json === 'object')
        ? (data.evaluation_json as EvaluationJson)
        : null;

      setEvaluationJson(parsed);

      const solved = Boolean(parsed?.test_summary?.all_passed);

      if (persistProgress) {
        await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'challenge',
            courseSlug: 'generator-code',
            courseTitle: 'Generator Code',
            challengeText: challenge,
            submittedCode: solutionCode,
            evaluation: parsed ?? { evaluation: raw },
            status: solved ? 'success' : 'submitted',
          }),
        });
      }

      await trackEvent({
        action: 'generator_code_validate',
        feature: 'generator_code_page',
        status: solved ? 'success' : 'error',
        metadata: {
          solved,
          passed: parsed?.test_summary?.passed ?? 0,
          total: parsed?.test_summary?.total ?? 0,
        },
      });
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Erreur pendant la validation.'));
      await trackEvent({
        action: 'generator_code_validate',
        feature: 'generator_code_page',
        status: 'error',
      });
    } finally {
      setValidating(false);
    }
  }

  const evaluationResults = evaluationJson?.test_results ?? [];
  const summary = evaluationJson?.test_summary;
  const latestRuntimeSeconds = useMemo(() => extractLatestRuntimeSeconds(consoleLines), [consoleLines]);

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-3 pb-4">
      <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-3 shadow-[2px_2px_0px_0px_#1C293C] flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/generator"
          className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au hub
        </Link>

        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Feature 01</p>
          <h1 className="font-black text-sm text-[#1C293C] mt-0.5">Mini challenge code IA</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">{level}</span>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">Python</span>
          <button
            type="button"
            onClick={() => setIsPromptModalOpen(true)}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
          >
            <Wand2 className="h-3.5 w-3.5" /> Inserer enonce et generer
          </button>

          <button
            type="button"
            onClick={() => generateResolvedCode(challenge, starterCode, challengeTests, true)}
            disabled={loadingSolution || !challenge.trim() || !starterCode.trim()}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {loadingSolution ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Code2 className="h-3.5 w-3.5" />}
            {loadingSolution ? 'Code...' : 'Regenerer code'}
          </button>
        </div>
      </div>

      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#1C293C]/50"
            onClick={() => !loadingScenario && setIsPromptModalOpen(false)}
          />

          <div className="relative w-full max-w-2xl border-2 border-[#1C293C] bg-white p-4 shadow-[6px_6px_0px_0px_#1C293C] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Texte de l enonce
                </p>
                <h2 className="mt-1 text-sm font-black text-[#1C293C]">Decris ce que tu veux generer</h2>
              </div>

              <button
                type="button"
                onClick={() => setIsPromptModalOpen(false)}
                disabled={loadingScenario}
                className="border-2 border-[#1C293C] bg-white px-2 py-1 text-xs font-black text-[#1C293C] disabled:opacity-40"
              >
                Fermer
              </button>
            </div>

            <textarea
              value={problemText}
              onChange={(event) => setProblemText(event.target.value)}
              className="w-full min-h-36 border-2 border-[#1C293C] bg-[#FBFBF9] p-3 text-sm text-[#1C293C]"
              placeholder="Ex: Cree un exercice sur les dictionnaires, fonctions pures, et cas limites explicites."
            />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-[#1C293C]">Niveau</label>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as 'debutant' | 'intermediaire' | 'avance')}
                  className="border-2 border-[#1C293C] bg-white px-2 py-1 text-xs font-semibold text-[#1C293C]"
                >
                  <option value="debutant">debutant</option>
                  <option value="intermediaire">intermediaire</option>
                  <option value="avance">avance</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateFromModal}
                disabled={loadingScenario || !problemText.trim()}
                className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
              >
                {loadingScenario ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {loadingScenario ? 'Generation...' : 'Generer et fermer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="border-2 border-[#DC2626] bg-[#DC2626]/10 p-3 shadow-[2px_2px_0px_0px_#1C293C]">
          <p className="text-sm font-semibold text-[#DC2626]">{error}</p>
        </div>
      )}

      {(loadingScenario || loadingSolution || generationPhase) && (
        <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Generation en cours</p>
          <p className="mt-1 text-xs font-semibold text-[#1C293C]">{generationPhase || 'Traitement...'}</p>
          <p className="text-[11px] text-[#1C293C]/70">API active: {activeApiBase}</p>
        </div>
      )}

      {activeWsUrl && (
        <div className="border-2 border-[#1C293C]/40 bg-white p-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">WebSocket actif</p>
          <p className="mt-1 text-[11px] text-[#1C293C]/80 break-all">{activeWsUrl}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <GeneratorSidePanel
          activeTab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          enonceText={enonceText}
          constraints={constraints}
          challengeDescription={challenge}
          solutionCode={solutionCode}
          level={level}
          consoleLines={consoleLines}
          runningConsole={runningConsole}
          terminalInput={terminalInput}
          terminalBodyRef={terminalBodyRef}
          onTerminalInputChange={setTerminalInput}
          onTerminalKeyDown={handleTerminalKeyDown}
          onStopExecution={stopExecution}
          onClearConsole={() => {
            setConsoleLines([]);
            setPlotPayload(null);
            setPerfPayload(null);
          }}
          onApplyToEditor={handleApplyFromChat}
        />

        <div className="xl:col-span-7 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Editeur Python (modifiable)
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunConsole}
                disabled={runningConsole || !solutionCode.trim()}
                className="border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
              >
                {runningConsole ? 'Execution...' : 'Executer'}
              </button>

              <button
                type="button"
                onClick={() => handleValidate(true)}
                disabled={validating || !solutionCode.trim() || !challenge.trim()}
                className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
              >
                {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                {validating ? 'Validation...' : 'Valider'}
              </button>
            </div>
          </div>

          <div className="border-2 border-[#1C293C] overflow-hidden">
            <Editor
              height="430px"
              defaultLanguage="python"
              value={solutionCode}
              onChange={(value) => setSolutionCode(value || '')}
              loading={<div className="h-[430px] bg-[#1e1e1e]" />}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                lineNumbersMinChars: 3,
              }}
            />
          </div>

          {summary && (
            <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Validation tests</p>
              <p className="mt-1 text-xs text-[#1C293C]">
                {summary.passed ?? 0}/{summary.total ?? 0} tests reussis
                {summary.all_passed ? ' (100%)' : ''}
              </p>
              {summary.runtime_error && (
                <p className="mt-1 text-xs text-[#DC2626]">Erreur runtime: {summary.runtime_error}</p>
              )}
              {evaluationResults.length > 0 && (
                <p className="mt-1 text-[11px] text-[#1C293C]/70">Utilise le bouton Valider pour recalculer ce statut.</p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
