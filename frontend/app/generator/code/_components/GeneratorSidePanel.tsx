'use client';

import { Loader2, MessageSquareText, Pencil, Send, Sparkles, Terminal } from 'lucide-react';
import GeneratorTerminalPanel from './GeneratorTerminalPanel';
import GeneratorTutorChat from './GeneratorTutorChat';
import { useState } from 'react';
import type { ConsoleLine, LeftPanelTab } from './types';

type GeneratorSidePanelProps = {
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
  problemText: string;
  onProblemTextChange: (value: string) => void;
  onGenerateCode: () => void;
  loadingCode: boolean;
  codeGenerated: boolean;
  challengeDescription: string;
  solutionCode: string;
  level: 'debutant' | 'intermediaire' | 'avance';
  consoleLines: ConsoleLine[];
  runningConsole: boolean;
  terminalInput: string;
  terminalBodyRef: React.RefObject<HTMLDivElement | null>;
  onTerminalInputChange: (value: string) => void;
  onTerminalKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onStopExecution: () => void;
  onClearConsole: () => void;
  onApplyToEditor: (code: string, mode: 'replace' | 'append') => void;
};

export default function GeneratorSidePanel({
  activeTab,
  onTabChange,
  problemText,
  onProblemTextChange,
  onGenerateCode,
  loadingCode,
  codeGenerated,
  challengeDescription,
  solutionCode,
  level,
  consoleLines,
  runningConsole,
  terminalInput,
  terminalBodyRef,
  onTerminalInputChange,
  onTerminalKeyDown,
  onStopExecution,
  onClearConsole,
  onApplyToEditor,
}: GeneratorSidePanelProps) {
  const [isEditing, setIsEditing] = useState(true);

  const isLocked = codeGenerated && !isEditing && !loadingCode;

  function handleGenerate() {
    setIsEditing(false);
    onGenerateCode();
  }

  return (
    <aside className="xl:col-span-5 h-full min-h-0 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-2 space-y-2 overflow-hidden">
      <div className="border-2 border-[#1C293C] bg-white h-full min-h-0 overflow-hidden flex flex-col">
        <div className="border-b-2 border-[#1C293C] bg-[#FBFBF9] p-1.5">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onTabChange('enonce')}
              className={`inline-flex items-center justify-center gap-1 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${activeTab === 'enonce' ? 'border-[#1C293C] bg-[#FDC800] text-[#1C293C] shadow-[1px_1px_0px_0px_#1C293C]' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <Sparkles className="h-3 w-3" /> Условие
            </button>
            <button
              type="button"
              onClick={() => onTabChange('terminal')}
              className={`inline-flex items-center justify-center gap-1 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${activeTab === 'terminal' ? 'border-[#1C293C] bg-[#1C293C] text-white shadow-[1px_1px_0px_0px_#1C293C]' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <Terminal className="h-3 w-3" /> Терминал
            </button>
            <button
              type="button"
              onClick={() => onTabChange('chat')}
              className={`inline-flex items-center justify-center gap-1 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${activeTab === 'chat' ? 'border-[#1C293C] bg-[#432DD7] text-white shadow-[1px_1px_0px_0px_#1C293C]' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <MessageSquareText className="h-3 w-3" /> Чат ИИ
            </button>
          </div>
        </div>

        {activeTab === 'enonce' && (
          <div className="p-2.5 flex flex-col gap-2 h-full min-h-0 overflow-y-auto">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1.5">Твое условие</p>
              {isLocked ? (
                <div className="relative w-full min-h-[280px] border-2 border-[#1C293C]/40 bg-[#F5F5F0] p-3">
                  <pre className="text-[12px] text-[#1C293C]/70 leading-relaxed whitespace-pre-wrap font-sans">{problemText}</pre>
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-black uppercase tracking-widest border border-[#1C293C]/30 bg-white px-1.5 py-0.5 text-[#1C293C]/50">
                      Заблокировано
                    </span>
                  </div>
                </div>
              ) : (
                <textarea
                  value={problemText}
                  onChange={(e) => onProblemTextChange(e.target.value)}
                  disabled={loadingCode}
                  placeholder="Вставь или напиши здесь условие задания по Python..."
                  className="w-full min-h-[280px] border-2 border-[#1C293C] bg-[#FBFBF9] p-3 text-[12px] text-[#1C293C] leading-relaxed resize-y focus:outline-none focus:ring-0 disabled:opacity-50"
                />
              )}
            </div>
            {isLocked ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 border-2 border-[#1C293C]/40 bg-white px-4 py-2 text-xs font-black text-[#1C293C]/70 shadow-[2px_2px_0px_0px_#1C293C]/20 hover:border-[#1C293C] hover:text-[#1C293C] hover:shadow-[2px_2px_0px_0px_#1C293C] transition-all duration-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Изменить условие
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loadingCode || !problemText.trim()}
                className="inline-flex items-center justify-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {loadingCode ? 'Генерация кода...' : 'Сгенерировать код'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
            <div className="p-2.5 h-full min-h-0">
            <GeneratorTerminalPanel
              consoleLines={consoleLines}
              runningConsole={runningConsole}
              terminalInput={terminalInput}
              terminalBodyRef={terminalBodyRef}
              onTerminalInputChange={onTerminalInputChange}
              onTerminalKeyDown={onTerminalKeyDown}
              onStopExecution={onStopExecution}
              onClearConsole={onClearConsole}
                minBodyHeightClassName="min-h-[260px]"
                maxBodyHeightClassName="max-h-[52vh]"
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="p-2.5 h-full min-h-0 overflow-hidden">
            <GeneratorTutorChat
              active={activeTab === 'chat'}
              challengeDescription={challengeDescription}
              enonceText={problemText}
              solutionCode={solutionCode}
              consoleLines={consoleLines}
              level={level}
              onApplyToEditor={onApplyToEditor}
            />
          </div>
        )}
      </div>
    </aside>
  );
}