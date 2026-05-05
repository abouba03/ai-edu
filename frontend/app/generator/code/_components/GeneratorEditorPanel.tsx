import Editor from '@monaco-editor/react';
import { Code2, Loader2, PlayCircle } from 'lucide-react';
import type { EvaluationJson } from './types';

type GeneratorEditorPanelProps = {
  solutionCode: string;
  challenge: string;
  runningConsole: boolean;
  validating: boolean;
  summary?: EvaluationJson['test_summary'];
  evaluationResultsCount: number;
  onCodeChange: (value: string) => void;
  onRunConsole: () => void;
  onValidate: () => void;
};

export default function GeneratorEditorPanel({
  solutionCode,
  challenge,
  runningConsole,
  validating,
  summary,
  evaluationResultsCount,
  onCodeChange,
  onRunConsole,
  onValidate,
}: GeneratorEditorPanelProps) {
  return (
    <div className="xl:col-span-7 h-full min-h-0 border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-2 flex flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" /> Редактор Python (можно менять)
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunConsole}
            disabled={runningConsole || !solutionCode.trim()}
            className="border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {runningConsole ? 'Выполнение...' : 'Запустить'}
          </button>

          <button
            type="button"
            onClick={onValidate}
            disabled={validating || !solutionCode.trim() || !challenge.trim()}
            className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40"
          >
            {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {validating ? 'Проверка...' : 'Проверить'}
          </button>
        </div>
      </div>

      <div className="border-2 border-[#1C293C] overflow-hidden flex-1 min-h-[280px]">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={solutionCode}
          onChange={(value) => onCodeChange(value || '')}
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
        <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Проверка тестов</p>
          <p className="mt-1 text-xs text-[#1C293C]">
            {summary.passed ?? 0}/{summary.total ?? 0} тестов пройдено
            {summary.all_passed ? ' (100%)' : ''}
          </p>
          {summary.runtime_error && (
            <p className="mt-1 text-xs text-[#DC2626]">Ошибка выполнения: {summary.runtime_error}</p>
          )}
          {evaluationResultsCount > 0 && (
            <p className="mt-1 text-[11px] text-[#1C293C]/70">Нажми «Проверить», чтобы обновить статус.</p>
          )}
        </div>
      )}
    </div>
  );
}
