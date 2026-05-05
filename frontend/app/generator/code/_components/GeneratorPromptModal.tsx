import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { GeneratorLevel } from './types';

type GeneratorPromptModalProps = {
  open: boolean;
  loadingScenario: boolean;
  problemText: string;
  level: GeneratorLevel;
  onClose: () => void;
  onProblemTextChange: (value: string) => void;
  onLevelChange: (value: GeneratorLevel) => void;
  onGenerate: () => void;
};

export default function GeneratorPromptModal({
  open,
  loadingScenario,
  problemText,
  level,
  onClose,
  onProblemTextChange,
  onLevelChange,
  onGenerate,
}: GeneratorPromptModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1C293C]/50" onClick={() => !loadingScenario && onClose()} />

      <div className="relative w-full max-w-2xl border-2 border-[#1C293C] bg-white p-4 shadow-[6px_6px_0px_0px_#1C293C] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Текст условия
            </p>
            <h2 className="mt-1 text-sm font-black text-[#1C293C]">Опиши, что нужно сгенерировать</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loadingScenario}
            className="border-2 border-[#1C293C] bg-white px-2 py-1 text-xs font-black text-[#1C293C] disabled:opacity-40"
          >
            Закрыть
          </button>
        </div>

        <textarea
          value={problemText}
          onChange={(event) => onProblemTextChange(event.target.value)}
          className="w-full min-h-36 border-2 border-[#1C293C] bg-[#FBFBF9] p-3 text-sm text-[#1C293C]"
          placeholder="Например: Создай задание по словарям, чистым функциям и явным граничным случаям."
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-[#1C293C]">Уровень</label>
            <select
              value={level}
              onChange={(event) => onLevelChange(event.target.value as GeneratorLevel)}
              className="border-2 border-[#1C293C] bg-white px-2 py-1 text-xs font-semibold text-[#1C293C]"
            >
              <option value="debutant">начальный</option>
              <option value="intermediaire">средний</option>
              <option value="avance">продвинутый</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={loadingScenario || !problemText.trim()}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {loadingScenario ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {loadingScenario ? 'Генерация кода...' : 'Сгенерировать код'}
          </button>
        </div>
      </div>
    </div>
  );
}
