'use client';

import Editor from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Code2, Loader2, Send, RotateCcw, Play } from 'lucide-react';

// Use local Monaco bundle to avoid CDN latency/blocking in dev environments.
loader.config({ monaco });

type Props = {
  code: string;
  starterCode: string;
  executing: boolean;
  submitting: boolean;
  submitted: boolean;
  challengeTimerMs: number | null;
  isChallengeValidated: boolean;
  executeTimeMs: number | null;
  onCodeChange: (v: string) => void;
  onExecute: () => void;
  onSubmit: () => void;
  onNewChallenge: () => void;
  loadingChallenge: boolean;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function ExerciseEditor({
  code,
  starterCode,
  executing,
  submitting,
  submitted,
  challengeTimerMs,
  isChallengeValidated,
  executeTimeMs,
  onCodeChange,
  onExecute,
  onSubmit,
  onNewChallenge,
  loadingChallenge,
}: Props) {
  return (
    <div className="flex flex-col h-full border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b-2 border-[#1C293C] bg-white shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Python редактор
          </p>
          {challengeTimerMs !== null && (
            <span
              className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 text-[10px] font-mono font-black ${
                isChallengeValidated
                  ? 'border-[#22C55E] bg-green-50 text-green-700'
                  : 'border-[#1C293C]/30 bg-[#FBFBF9] text-[#1C293C]'
              }`}
            >
              {isChallengeValidated ? '🏁' : '⏱'} Время задачи: {formatDuration(challengeTimerMs)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reset to starter */}
          <button
            type="button"
            onClick={() => onCodeChange(starterCode)}
            disabled={submitting || loadingChallenge}
            title="Вернуть стартовый код"
            className="border-2 border-[#1C293C] bg-white p-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Nouveau challenge */}
          <button
            type="button"
            onClick={onNewChallenge}
            disabled={submitting || loadingChallenge}
            className="border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {loadingChallenge ? 'Генерация...' : '⟳ Новая задача'}
          </button>

          {/* Soumettre */}
          <button
            type="button"
            onClick={onExecute}
            disabled={executing || submitting || loadingChallenge || !code.trim()}
            className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#22C55E] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {executing
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Выполнение...</>
              : <><Play className="h-3.5 w-3.5" /> Запустить</>
            }
          </button>

          {/* Soumettre */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={executing || submitting || loadingChallenge || !code.trim()}
            className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Проверка...</>
              : <><Send className="h-3.5 w-3.5" /> Отправить</>
            }
          </button>
        </div>
      </div>

      {/* Monaco editor */}
      <div className="flex-1 border-t-0 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="python"
          language="python"
          value={code}
          onChange={(v) => onCodeChange(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            readOnly: submitting,
            padding: { top: 12 },
          }}
        />
      </div>

      {/* Hint sous l'éditeur */}
      {!submitted && !submitting && !executing && (
        <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] text-gray-500">
              Сначала нажми <strong>Запустить</strong>, чтобы увидеть тесты, затем <strong>Отправить</strong>, чтобы сохранить результат и прогресс.
            </p>
            {executeTimeMs !== null && (
              <span className="inline-flex items-center gap-1 border border-[#432DD7]/35 bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-[#432DD7]">
                ⏱ время: {(executeTimeMs / 1000).toFixed(6)} с
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
