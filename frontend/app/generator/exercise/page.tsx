'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ExerciseTopBar from './_components/ExerciseTopBar';
import ExerciseSidebar from './_components/ExerciseSidebar';
import ExerciseEditor from './_components/ExerciseEditor';
import ExerciseResultModal from './_components/ExerciseResultModal';
import type {
  ExecuteResult,
  ExerciseStats,
  GeneratedExercise,
  SidebarTab,
  SubmitResult,
} from './_components/types';

function toRuError(detail?: string): string {
  const raw = String(detail ?? '').trim();
  if (!raw) return 'Произошла ошибка. Попробуй снова.';

  if (raw === 'unauthenticated') return 'Нужно войти в аккаунт.';
  if (raw === 'invalid_json') return 'Неверный формат данных.';
  if (raw === 'db_temporarily_unavailable') return 'База данных временно недоступна. Попробуй чуть позже.';
  if (raw === 'server_error') return 'Ошибка сервера.';
  if (raw.startsWith('execution_failed:')) return 'Ошибка при выполнении кода в рантайме.';

  return raw;
}

function looksRussian(text: string): boolean {
  return /[А-Яа-яЁё]/.test(String(text || ''));
}

function isRussianExercise(data: GeneratedExercise): boolean {
  const probes = [
    data.challenge,
    data.challenge_json?.enonce,
    data.challenge_json?.exemple,
    ...(data.challenge_json?.contraintes ?? []),
    ...(data.challenge_json?.hints ?? []),
  ].map((v) => String(v ?? ''));

  const count = probes.filter(looksRussian).length;
  return count >= 3;
}

export default function ExercisePage() {
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [exercise, setExercise] = useState<GeneratedExercise | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState('');
  const [code, setCode] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('enonce');
  const [lastDifficultyChange, setLastDifficultyChange] = useState<number | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState(false);
  const [performanceRunsMs, setPerformanceRunsMs] = useState<number[]>([]);

  // Chronomètre challenge : temps depuis le chargement jusqu'à la validation
  const challengeStartedAt = useRef<number | null>(null);
  const [validationMs, setValidationMs] = useState<number | null>(null);
  const [challengeTimerMs, setChallengeTimerMs] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/exercise/stats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as ExerciseStats;
        setStats(data);
      }
    } catch { /* noop */ }
    finally { setStatsLoading(false); }
  }, []);

  const loadLatestChallenge = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/exercise/latest', { cache: 'no-store' });
      if (!res.ok) {
        return false;
      }

      const data = await res.json() as GeneratedExercise;
      if (!isRussianExercise(data)) {
        // Older cached drafts can still be in French: force a fresh RU generation.
        return false;
      }
      setExercise(data);
      setCode(data.starter_code ?? '');
      setChallengeError('');
      setSidebarTab('enonce');
      challengeStartedAt.current = Date.now();
      setValidationMs(null);
      setChallengeTimerMs(0);
      setPerformanceRunsMs([]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const generateChallenge = useCallback(async () => {
    setLoadingChallenge(true);
    setChallengeError('');
    setExecuteResult(null);
    setSubmitResult(null);
    setShowModal(false);
    setLastDifficultyChange(null);
    setLastLevelUp(false);
    setValidationMs(null);
    setChallengeTimerMs(null);
    setPerformanceRunsMs([]);
    challengeStartedAt.current = null;
    setSidebarTab('enonce');

    try {
      const res = await fetch('/api/exercise/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        setChallengeError(toRuError(err.detail) || 'Ошибка генерации.');
        return;
      }
      const data = await res.json() as GeneratedExercise;
      setExercise(data);
      setCode(data.starter_code ?? '');
      challengeStartedAt.current = Date.now();
      setValidationMs(null);
      setChallengeTimerMs(0);
      setPerformanceRunsMs([]);
    } catch {
      setChallengeError('Не удалось сгенерировать задачу. Проверь подключение.');
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!exercise || !code.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/exercise/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_description: exercise.challenge_json.enonce,
          challenge_json: exercise.challenge_json,
          challenge_tests: exercise.challenge_tests,
          student_code: code,
          difficulty: exercise.difficulty,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        setChallengeError(toRuError(err.detail) || 'Ошибка при отправке.');
        return;
      }
      const result = await res.json() as SubmitResult;
      // Chrono : si pas déjà validé via execute, calculer maintenant
      if (validationMs == null && challengeStartedAt.current != null) {
        const elapsed = Date.now() - challengeStartedAt.current;
        setValidationMs(elapsed);
        setChallengeTimerMs(elapsed);
      }
      setSubmitResult(result);
      setStats(result.stats);
      setLastDifficultyChange(result.difficultyChange);
      setLastLevelUp(result.levelUp);
      setSidebarTab('tests');
      setShowModal(true);
    } catch {
      setChallengeError('Сетевая ошибка при отправке.');
    } finally {
      setSubmitting(false);
    }
  }, [exercise, code, validationMs]);

  const handleExecute = useCallback(async () => {
    if (!exercise || !code.trim()) return;
    setExecuting(true);
    setChallengeError('');
    setSidebarTab('tests');

    try {
      const res = await fetch('/api/exercise/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_description: exercise.challenge_json.enonce,
          challenge_tests: exercise.challenge_tests,
          student_code: code,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        setChallengeError(toRuError(err.detail) || 'Ошибка во время запуска тестов.');
        return;
      }

      const result = await res.json() as ExecuteResult;
      const execTimeRaw = result.evaluationJson?.test_summary?.exec_time_ms;
      const execTimeMs = typeof execTimeRaw === 'number' ? execTimeRaw : Number(execTimeRaw);
      if (Number.isFinite(execTimeMs) && execTimeMs > 0) {
        setPerformanceRunsMs((prev) => [...prev, execTimeMs].slice(-30));
      }

      // Valider si tous les tests passent → chrono
      const elapsed = challengeStartedAt.current != null ? Date.now() - challengeStartedAt.current : null;
      const isFullPass = result.evaluationJson?.test_summary?.all_passed === true || result.passed === true;
      const enriched: ExecuteResult = {
        ...result,
        validationMs: (isFullPass && elapsed != null) ? elapsed : undefined,
      };
      if (isFullPass && elapsed != null) {
        setValidationMs(elapsed);
        setChallengeTimerMs(elapsed);
      }
      setExecuteResult(enriched);
    } catch {
      setChallengeError('Сетевая ошибка во время запуска тестов.');
    } finally {
      setExecuting(false);
    }
  }, [exercise, code]);

  useEffect(() => {
    if (challengeStartedAt.current == null || validationMs !== null) {
      return;
    }

    const tick = () => {
      if (challengeStartedAt.current != null) {
        setChallengeTimerMs(Date.now() - challengeStartedAt.current);
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [exercise, validationMs]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    let cancelled = false;

    async function bootstrapChallenge() {
      setLoadingChallenge(true);
      const loaded = await loadLatestChallenge();
      if (!loaded && !cancelled) {
        await generateChallenge();
      }
      if (!cancelled && loaded) {
        setLoadingChallenge(false);
      }
    }

    bootstrapChallenge();
    return () => {
      cancelled = true;
    };
  }, [loadLatestChallenge, generateChallenge]);

  const currentExecMs = executeResult?.evaluationJson?.test_summary?.exec_time_ms ?? null;
  const bestExecMs = performanceRunsMs.length > 0 ? Math.min(...performanceRunsMs) : null;
  const avgExecMs = performanceRunsMs.length > 0
    ? performanceRunsMs.reduce((sum, v) => sum + v, 0) / performanceRunsMs.length
    : null;
  const deltaVsBestMs = (currentExecMs != null && bestExecMs != null) ? currentExecMs - bestExecMs : null;
  const deltaVsBestPct = (deltaVsBestMs != null && bestExecMs != null && bestExecMs > 0)
    ? (deltaVsBestMs / bestExecMs) * 100
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F5F5F0]">
      <ExerciseTopBar
        stats={stats}
        loading={statsLoading}
        difficultyChange={lastDifficultyChange}
        levelUp={lastLevelUp}
        concepts={exercise?.challenge_json?.concepts ?? []}
      />

      {challengeError && (
        <div className="mt-2 border-2 border-[#DC2626] bg-red-50 px-3 py-2 text-sm text-[#DC2626] font-semibold flex items-center justify-between shrink-0">
          <span>{challengeError}</span>
          <button type="button" onClick={() => setChallengeError('')} className="text-[#DC2626] hover:opacity-70 ml-4">x</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col xl:flex-row gap-2 overflow-hidden">
        <div className="w-full xl:w-[380px] shrink-0 flex flex-col overflow-hidden">
          <ExerciseSidebar
            challengeJson={exercise?.challenge_json ?? null}
            challengeTests={exercise?.challenge_tests ?? null}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            loading={loadingChallenge}
            executing={executing}
            executeResult={executeResult}
            validationMs={validationMs}
            performanceSummary={{
              runs: performanceRunsMs.length,
              currentMs: currentExecMs,
              bestMs: bestExecMs,
              averageMs: avgExecMs,
              deltaVsBestMs,
              deltaVsBestPct,
            }}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ExerciseEditor
            code={code}
            starterCode={exercise?.starter_code ?? ''}
            executing={executing}
            submitting={submitting}
            submitted={submitResult !== null}
            challengeTimerMs={challengeTimerMs}
            isChallengeValidated={validationMs !== null}
            executeTimeMs={executeResult?.evaluationJson?.test_summary?.exec_time_ms ?? null}
            onCodeChange={setCode}
            onExecute={handleExecute}
            onSubmit={handleSubmit}
            onNewChallenge={generateChallenge}
            loadingChallenge={loadingChallenge}
          />
        </div>
      </div>

      {showModal && submitResult && (
        <ExerciseResultModal
          result={submitResult}
          onClose={() => setShowModal(false)}
          onNewChallenge={generateChallenge}
        />
      )}
    </div>
  );
}
