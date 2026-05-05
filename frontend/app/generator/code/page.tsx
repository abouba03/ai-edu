'use client';

import { useEffect, useRef, useState } from 'react';
import { loader } from '@monaco-editor/react';
import { io, type Socket } from 'socket.io-client';
import { trackEvent } from '@/lib/event-tracker';
import GeneratorSidePanel from './_components/GeneratorSidePanel';
import GeneratorCodeTopBar from './_components/GeneratorCodeTopBar';
import GeneratorEditorPanel from './_components/GeneratorEditorPanel';
import type { ChallengeTests, ConsoleLine, EvaluationJson, GeneratorLevel, LeftPanelTab } from './_components/types';
import {
  apiBaseUrl,
  buildSocketIoCandidates,
  buildWsCandidates,
  clampPrompt,
  extractApiErrorMessage,
  extractTopic,
  isAxiosTimeoutError,
  normalizeBaseUrl,
  postJsonWithFallback,
  pythonRuntimeBaseUrl,
  REQUEST_TIMEOUT_MS,
} from './_components/generatorCodeUtils';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

export default function GeneratorCodePage() {
  const [problemText, setProblemText] = useState('');
  const [level, setLevel] = useState<GeneratorLevel>('intermediaire');

  const [challenge, setChallenge] = useState('');
  const [challengeTests] = useState<ChallengeTests | null>(null);
  const [solutionCode, setSolutionCode] = useState('');

  // ── Console / terminal state ──────────────────────────────────────────
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  const [evaluationJson, setEvaluationJson] = useState<EvaluationJson | null>(null);
  const [error, setError] = useState('');
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [runningConsole, setRunningConsole] = useState(false);
  const [validating, setValidating] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('enonce');
  const [activeApiBase, setActiveApiBase] = useState(normalizeBaseUrl(apiBaseUrl));
  const [generationPhase, setGenerationPhase] = useState('');
  const [activeWsUrl, setActiveWsUrl] = useState('');
  const activeApiBaseRef = useRef(normalizeBaseUrl(apiBaseUrl));

  const starterCode = [
    'def solution(*args):',
    '    """Реализуй решение здесь."""',
    '    pass',
  ].join('\n');

  useEffect(() => {
    activeApiBaseRef.current = activeApiBase;
  }, [activeApiBase]);

  // Auto-scroll terminal on new output
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [consoleLines]);

  async function evaluateCandidateCode(candidateCode: string): Promise<EvaluationJson | null> {
    if (!challenge.trim() || !candidateCode.trim()) return null;

    try {
      const { data, baseUrl } = await postJsonWithFallback<{ evaluation_json?: EvaluationJson }>('/submit-challenge/', {
        challenge_description: challenge,
        student_code: candidateCode,
        challenge_tests: challengeTests,
        pedagogy_context: {
          pedagogicalStyle: 'Проверка по тестам и понятная обратная связь',
          aiTone: 'Точный дружелюбный наставник',
          targetAudience: 'Студент',
          courseTitle: extractTopic(problemText),
          responseLanguage: 'простой русский',
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

    setError('');
    setLoadingSolution(true);
    setGenerationPhase('Генерация кода ИИ...');

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
        'Ты эксперт по Python и учебный наставник.',
        'Твоя задача: дать правильное, понятное и запускаемое решение задания.',
        '',
        'Обязательные правила:',
        '1) Точно следуй условию задачи.',
        '2) Если задача из нескольких шагов, разбей решение на логичные блоки/функции.',
        '3) Пиши просто, читаемо и эффективно без лишнего кода.',
        '4) Учитывай граничные случаи и типичные ошибки ввода.',
        '5) Строго соблюдай заданный шаблон/сигнатуру.',
        '6) Не используй внешние библиотеки без явного запроса.',
        '7) Код должен запускаться сразу.',
        '8) Если есть тесты, решение должно их проходить.',
        '9) Добавь 1-2 коротких примера запуска.',
        '10) Если определяешь функцию, добавь блок if __name__ == "__main__":.',
        '',
        'Формат ответа:',
        '- Верни только финальный Python-код (без пояснений вне кода).',
        '- В коде должно быть решение и короткий пример использования.',
        '- Код должен быть компактным и понятным.',
        '',
        'Входные данные:',
        'УСЛОВИЕ:',
        nextChallenge,
        '',
        'ШАБЛОН (если есть):',
        nextStarterCode,
        '',
        'ТЕСТЫ/ОГРАНИЧЕНИЯ (если есть):',
        JSON.stringify(nextTests || {}),
      ].join('\n'));

      const generatePayload = {
        pedagogy_context: {
          pedagogicalStyle: 'Полное проверяемое и понятное решение',
          aiTone: 'Точный технический наставник',
          targetAudience: 'Студент',
          responseLanguage: 'простой русский',
        },
      };

      let firstGenerateData: { code?: string; explanation?: string } | undefined;
      let generateBase = activeApiBaseRef.current;
      try {
        const first = await postJsonWithFallback<{ code?: string; explanation?: string }>(
          '/generate/',
          { ...generatePayload, prompt: basePrompt },
          REQUEST_TIMEOUT_MS.generateCode,
          activeApiBaseRef.current,
        );
        firstGenerateData = first.data;
        generateBase = first.baseUrl;
      } catch (err) {
        if (!isAxiosTimeoutError(err)) {
          throw err;
        }

        setGenerationPhase('Время ожидания вышло, быстрый перезапуск...');
        const compactChallenge = nextChallenge.slice(0, 1600);
        const compactStarter = nextStarterCode.slice(0, 1200);
        const compactTests = JSON.stringify(nextTests || {}).slice(0, 1200);

        const fastPrompt = clampPrompt([
          'Ты эксперт Python. Дай быстрое и корректное решение.',
          'Верни только финальный исполняемый Python-код.',
          'Добавь пример запуска в if __name__ == "__main__":',
          'Будь краток: 1 главный пример без длинного набора тестов.',
          '',
          'УСЛОВИЕ (кратко):',
          compactChallenge,
          '',
          'ШАБЛОН (кратко):',
          compactStarter,
          '',
          'ТЕСТЫ/ОГРАНИЧЕНИЯ (кратко):',
          compactTests,
        ].join('\n'));

        const retry = await postJsonWithFallback<{ code?: string; explanation?: string }>(
          '/generate/',
          { ...generatePayload, prompt: fastPrompt },
          REQUEST_TIMEOUT_MS.generateCode,
          activeApiBaseRef.current,
        );
        firstGenerateData = retry.data;
        generateBase = retry.baseUrl;
      }

      setActiveApiBase(generateBase);

      let bestCode = String(firstGenerateData?.code ?? '').trim() || '# Ответ с кодом не получен';
      let bestEvaluation = await evaluateCandidateCode(bestCode);

      const firstPassed = bestEvaluation?.test_summary?.passed ?? 0;
      const total = bestEvaluation?.test_summary?.total ?? 0;
      const needsFix = Boolean(total > 0 && !bestEvaluation?.test_summary?.all_passed);

      if (needsFix) {
        setGenerationPhase('Автокоррекция по результатам тестов...');
        const failingTests = (bestEvaluation?.test_results ?? [])
          .filter((test) => test.status !== 'passed')
          .map((test) => {
            const name = test.name || 'тест';
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
          'Предыдущий код проходит не все тесты. Исправь его.',
          'Обязательная цель: 100% прохождения тестов.',
          'Сохрани чистую структуру решения и пример запуска в конце.',
          '',
          'Предыдущий код:',
          previousCodeForFix,
          '',
          'Падающие тесты:',
          failingTestsForFix,
          '',
          'Верни только исправленный финальный Python-код.',
        ].join('\n'));

        const { data: retryData, baseUrl: retryBase } = await postJsonWithFallback<{ code?: string; explanation?: string }>('/generate/', {
          prompt: fixPrompt,
          pedagogy_context: {
            pedagogicalStyle: 'Точная коррекция по падающим тестам',
            aiTone: 'Точный технический наставник',
            targetAudience: 'Студент',
            responseLanguage: 'простой русский',
          },
        }, REQUEST_TIMEOUT_MS.generateCode, activeApiBaseRef.current);

        setActiveApiBase(retryBase);

        const retryCode = String(retryData?.code ?? '').trim();

        if (retryCode) {
          const retryEvaluation = await evaluateCandidateCode(retryCode);
          const retryPassed = retryEvaluation?.test_summary?.passed ?? 0;
          const retryAllPassed = Boolean(retryEvaluation?.test_summary?.all_passed);

          if (retryAllPassed || retryPassed >= firstPassed) {
            bestCode = retryCode;
            bestEvaluation = retryEvaluation;
          }
        }
      }

      setSolutionCode(bestCode);
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
      setError(extractApiErrorMessage(err, 'Ошибка во время генерации решения.'));
      setSolutionCode([
        '# Автогенерация не удалась.',
        '# Возможная причина: таймаут ИИ или некорректный ответ модели.',
        '# Действие: нажми «Сгенерировать заново» или упрости условие.',
        '',
        'def solution(*args):',
        '    """Резервный шаблон."""',
        '    pass',
      ].join('\n'));
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

  async function handleDirectGenerate() {
    const normalized = problemText.trim();
    if (!normalized || loadingSolution) return;

    setChallenge(normalized);
    setEvaluationJson(null);
    setConsoleLines([]);
    setTerminalInput('');
    await generateResolvedCode(normalized, starterCode, null, true);
  }

  function stopExecution() {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRunningConsole(false);
  }

  async function handleRunConsole() {
    if (!solutionCode.trim() || runningConsole) return;

    // Close any previous session
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRunningConsole(true);
    setLeftPanelTab('terminal');
    setConsoleLines([{ kind: 'meta', text: '$ python solution.py\n' }]);
    setTerminalInput('');

    const socketCandidates = buildSocketIoCandidates(pythonRuntimeBaseUrl);
    let socketAttempt = 0;

    const connectSocketIo = () => {
      if (socketAttempt >= socketCandidates.length) {
        connectWebSocketFallback();
        return;
      }

      const socketUrl = socketCandidates[socketAttempt];
      socketAttempt += 1;

      const socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        timeout: 4000,
        reconnection: false,
      });

      socketRef.current = socket;
      setActiveWsUrl(`socket.io ${socketUrl}`);

      let opened = false;
      let finished = false;
      let movedNext = false;

      const moveToNextSocketCandidate = () => {
        if (movedNext) return;
        movedNext = true;
        try {
          socket.removeAllListeners();
          socket.disconnect();
        } catch {
          // ignore
        }
        connectSocketIo();
      };

      socket.on('connect', () => {
        opened = true;
        socket.emit('execute_code', { code: solutionCode });
      });

      const appendStream = (kind: 'stdout' | 'stderr', payload: { data?: string }) => {
        const chunk = payload?.data ?? '';
        setConsoleLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.kind === kind) {
            return [...prev.slice(0, -1), { kind: last.kind, text: last.text + chunk }];
          }
          return [...prev, { kind, text: chunk }];
        });
      };

      socket.on('stdout', (payload: { data?: string }) => appendStream('stdout', payload));
      socket.on('stderr', (payload: { data?: string }) => appendStream('stderr', payload));
      socket.on('meta', (payload: { data?: string }) => {
        setConsoleLines((prev) => [...prev, { kind: 'meta', text: `${payload?.data ?? ''}\n` }]);
      });
      socket.on('exit', (payload: { code?: number }) => {
        finished = true;
        const rc = payload?.code ?? 0;
        setConsoleLines((prev) => [...prev, { kind: 'meta', text: `Процесс завершен с кодом ${rc}\n` }]);
        setRunningConsole(false);
        setActiveWsUrl('');
        socket.disconnect();
        socketRef.current = null;
      });

      socket.on('connect_error', () => {
        if (!opened) {
          moveToNextSocketCandidate();
        }
      });

      socket.on('disconnect', () => {
        if (!opened && !finished) {
          moveToNextSocketCandidate();
          return;
        }
        if (!finished) {
          setRunningConsole(false);
          setActiveWsUrl('');
        }
      });
    };

    const wsCandidates = buildWsCandidates(pythonRuntimeBaseUrl);
    let attemptIndex = 0;

    const connectWebSocketFallback = () => {
      if (attemptIndex >= wsCandidates.length) {
        setLeftPanelTab('terminal');
        setConsoleLines((prev) => [
          ...prev,
          {
            kind: 'stderr',
            text: `Ошибка терминала в реальном времени — Socket.IO (8003) и WebSocket API (8002) недоступны. Запусти start-all.bat и попробуй снова. Попытки WS: ${wsCandidates.join(' | ')}`,
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
              { kind: 'meta', text: `Процесс завершен с кодом ${rc}\n` },
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
          connectWebSocketFallback();
          return;
        }
        setRunningConsole(false);
        wsRef.current = null;
        setActiveWsUrl('');
      };
    };

    connectSocketIo();
  }

  function handleTerminalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const line = terminalInput;
    if (socketRef.current && socketRef.current.connected) {
      setConsoleLines((prev) => [...prev, { kind: 'stdin', text: `${line}\n` }]);
      socketRef.current.emit('stdin', { data: line });
      setTerminalInput('');
      return;
    }

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
          pedagogicalStyle: 'Проверка по тестам и понятная обратная связь',
          aiTone: 'Точный дружелюбный наставник',
          targetAudience: 'Студент',
          courseTitle: extractTopic(problemText),
          responseLanguage: 'простой русский',
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
      setError(extractApiErrorMessage(err, 'Ошибка во время проверки.'));
      await trackEvent({
        action: 'generator_code_validate',
        feature: 'generator_code_page',
        status: 'error',
      });
    } finally {
      setValidating(false);
    }
  }

  const summary = evaluationJson?.test_summary;
  const evaluationResultsCount = evaluationJson?.test_results?.length ?? 0;

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 overflow-hidden">
      <GeneratorCodeTopBar
        level={level}
        loadingSolution={loadingSolution}
        canRegenerate={Boolean(challenge.trim())}
        onRegenerate={() => generateResolvedCode(challenge, starterCode, challengeTests, true)}
      />

      {error && (
        <div className="border-2 border-[#DC2626] bg-[#DC2626]/10 p-2.5 shadow-[2px_2px_0px_0px_#1C293C] shrink-0">
          <p className="text-sm font-semibold text-[#DC2626]">{error}</p>
        </div>
      )}

      {(loadingSolution || generationPhase) && (
        <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5 shadow-[2px_2px_0px_0px_#1C293C] shrink-0">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Идет генерация</p>
          <p className="mt-1 text-xs font-semibold text-[#1C293C]">{generationPhase || 'Обработка...'}</p>
          <p className="text-[11px] text-[#1C293C]/70">Активный API: {activeApiBase}</p>
        </div>
      )}

      {activeWsUrl && (
        <div className="border-2 border-[#1C293C]/40 bg-white p-2.5 shadow-[2px_2px_0px_0px_#1C293C] shrink-0">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Активный WebSocket</p>
          <p className="mt-1 text-[11px] text-[#1C293C]/80 break-all">{activeWsUrl}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
        <GeneratorSidePanel
          activeTab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          problemText={problemText}
          onProblemTextChange={setProblemText}
          onGenerateCode={handleDirectGenerate}
          loadingCode={loadingSolution}
          codeGenerated={Boolean(solutionCode.trim())}
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
          }}
          onApplyToEditor={handleApplyFromChat}
        />

        <GeneratorEditorPanel
          solutionCode={solutionCode}
          challenge={challenge}
          runningConsole={runningConsole}
          validating={validating}
          summary={summary}
          evaluationResultsCount={evaluationResultsCount}
          onCodeChange={setSolutionCode}
          onRunConsole={handleRunConsole}
          onValidate={() => handleValidate(true)}
        />
      </div>
    </div>
  );
}
