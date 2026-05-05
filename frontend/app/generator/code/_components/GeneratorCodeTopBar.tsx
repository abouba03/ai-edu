import Link from 'next/link';
import { ArrowLeft, Code2, Loader2 } from 'lucide-react';
import type { GeneratorLevel } from './types';

type GeneratorCodeTopBarProps = {
  level: GeneratorLevel;
  loadingSolution: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
};

export default function GeneratorCodeTopBar({
  level,
  loadingSolution,
  canRegenerate,
  onRegenerate,
}: GeneratorCodeTopBarProps) {
  const levelRu: Record<GeneratorLevel, string> = {
    debutant: 'начальный',
    intermediaire: 'средний',
    avance: 'продвинутый',
  };

  return (
    <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5 shadow-[2px_2px_0px_0px_#1C293C] flex items-center justify-between gap-2.5 flex-wrap">
      <Link
        href="/generator"
        className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-2.5 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Назад к генератору
      </Link>

      <div>
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Инструмент</p>
        <h1 className="font-black text-sm text-[#1C293C] mt-0.5">ИИ генератор кода</h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">
          {levelRu[level]}
        </span>
        <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]/60">Python</span>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={loadingSolution || !canRegenerate}
          className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
        >
          {loadingSolution ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Code2 className="h-3.5 w-3.5" />}
          {loadingSolution ? 'Код...' : 'Сгенерировать заново'}
        </button>
      </div>
    </div>
  );
}
