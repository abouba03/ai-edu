'use client';

import type React from 'react';
import { Terminal, X } from 'lucide-react';
import type { ConsoleLine } from './types';

type GeneratorTerminalPanelProps = {
  consoleLines: ConsoleLine[];
  runningConsole: boolean;
  terminalInput: string;
  terminalBodyRef: React.RefObject<HTMLDivElement | null>;
  onTerminalInputChange: (value: string) => void;
  onTerminalKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onStopExecution: () => void;
  onClearConsole: () => void;
  minBodyHeightClassName?: string;
  maxBodyHeightClassName?: string;
};

export default function GeneratorTerminalPanel({
  consoleLines,
  runningConsole,
  terminalInput,
  terminalBodyRef,
  onTerminalInputChange,
  onTerminalKeyDown,
  onStopExecution,
  onClearConsole,
  minBodyHeightClassName = 'min-h-40',
  maxBodyHeightClassName = 'max-h-64',
}: GeneratorTerminalPanelProps) {
  return (
    <div className="border-2 border-[#1C293C] overflow-hidden">
      <div className="flex items-center justify-between bg-[#1C293C] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FDC800]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
          <Terminal className="ml-1 h-3 w-3 text-white/40" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
            Terminal Python
          </span>
          {runningConsole && (
            <span className="text-[10px] text-[#4ade80] animate-pulse">● en cours</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {runningConsole && (
            <button
              type="button"
              onClick={onStopExecution}
              className="border border-[#f87171]/40 px-2 py-0.5 text-[10px] font-black text-[#f87171] transition-colors hover:text-white"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={onClearConsole}
            className="text-white/40 transition-colors hover:text-white"
            title="Effacer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={terminalBodyRef}
        className={`overflow-y-auto bg-[#0d1117] px-4 pt-3 pb-1 ${minBodyHeightClassName} ${maxBodyHeightClassName}`}
      >
        {consoleLines.length === 0 ? (
          <p className="select-none text-xs font-mono text-white/20">
            Prete. Clique sur Executer pour lancer le code.
          </p>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-xs font-mono leading-relaxed">
            {consoleLines.map((seg, index) => {
              const color =
                seg.kind === 'stderr'
                  ? 'text-[#f87171]'
                  : seg.kind === 'stdin'
                  ? 'text-[#FDC800]'
                  : seg.kind === 'meta'
                  ? 'text-white/35'
                  : 'text-[#e6edf3]';
              const prefix = seg.kind === 'stdin' ? '> ' : '';

              return (
                <span key={`${seg.kind}-${index}`} className={color}>
                  {prefix}{seg.text}
                </span>
              );
            })}
          </pre>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-[#161b22] px-3 py-2">
        <span className="select-none font-mono text-sm text-[#FDC800]">
          {runningConsole ? '›' : '$'}
        </span>
        <input
          type="text"
          value={terminalInput}
          onChange={(event) => onTerminalInputChange(event.target.value)}
          onKeyDown={onTerminalKeyDown}
          disabled={!runningConsole}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            runningConsole
              ? 'Tape une valeur et appuie sur Entree…'
              : 'Lance le code pour interagir'
          }
          className="flex-1 bg-transparent text-xs font-mono text-[#e6edf3] placeholder:text-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        />
      </div>
    </div>
  );
}