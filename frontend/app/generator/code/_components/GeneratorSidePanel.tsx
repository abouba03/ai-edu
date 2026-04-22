'use client';

import { MessageSquareText, Sparkles, Terminal } from 'lucide-react';
import GeneratorTerminalPanel from './GeneratorTerminalPanel';
import GeneratorTutorChat from './GeneratorTutorChat';
import type { ConsoleLine, LeftPanelTab } from './types';

type GeneratorSidePanelProps = {
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
  enonceText: string;
  constraints: string[];
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
  enonceText,
  constraints,
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
  const fallbackConstraints = [
    'Ecrire du Python executable.',
    'Respecter la signature attendue.',
    'Traiter les cas limites.',
    'Produire un code lisible et testable.',
  ];

  return (
    <aside className="xl:col-span-5 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-3 space-y-3">
      <div className="border-2 border-[#1C293C] bg-white min-h-[380px] overflow-hidden">
        <div className="border-b-2 border-[#1C293C] bg-[#FBFBF9] p-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onTabChange('enonce')}
              className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'enonce' ? 'border-[#1C293C] bg-[#FDC800] text-[#1C293C]' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <Sparkles className="h-3 w-3" /> Enonce
            </button>
            <button
              type="button"
              onClick={() => onTabChange('terminal')}
              className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'border-[#1C293C] bg-[#1C293C] text-white' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <Terminal className="h-3 w-3" /> Terminal Python
            </button>
            <button
              type="button"
              onClick={() => onTabChange('chat')}
              className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'border-[#1C293C] bg-[#432DD7] text-white' : 'border-[#1C293C]/20 bg-white text-[#1C293C]/60'}`}
            >
              <MessageSquareText className="h-3 w-3" /> Chat IA
            </button>
          </div>
        </div>

        {activeTab === 'enonce' && (
          <div className="max-h-[58vh] overflow-y-auto p-3 pr-2">
            <div className="space-y-2">
              <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Enonce</p>
                <pre className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[#1C293C]">{enonceText}</pre>
              </div>

              <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Contraintes</p>
                {(constraints.length > 0 ? constraints : fallbackConstraints).map((item, index) => (
                  <p key={`${item}-${index}`} className="mt-1 text-[12px] text-[#1C293C]">{index + 1}. {item}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="p-3">
            <GeneratorTerminalPanel
              consoleLines={consoleLines}
              runningConsole={runningConsole}
              terminalInput={terminalInput}
              terminalBodyRef={terminalBodyRef}
              onTerminalInputChange={onTerminalInputChange}
              onTerminalKeyDown={onTerminalKeyDown}
              onStopExecution={onStopExecution}
              onClearConsole={onClearConsole}
              minBodyHeightClassName="min-h-[380px]"
              maxBodyHeightClassName="max-h-[58vh]"
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="p-3">
            <GeneratorTutorChat
              active={activeTab === 'chat'}
              challengeDescription={challengeDescription}
              enonceText={enonceText}
              solutionCode={solutionCode}
              level={level}
              onApplyToEditor={onApplyToEditor}
            />
          </div>
        )}
      </div>
    </aside>
  );
}