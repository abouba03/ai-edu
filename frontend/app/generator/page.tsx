import { Suspense } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import AiTutorPanel from './_components/AiTutorPanel';

export default function GeneratorPage() {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] px-4 py-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest font-black text-[#432DD7]">Модуль ИИ</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-[#1C293C] lg:text-3xl">
              ИИ Тьютор
            </h1>
            <p className="mt-1.5 max-w-xl text-xs font-medium text-[#1C293C]/60 sm:text-sm">
              Упражнения, сгенерированные персонально для тебя — на основе твоих результатов квизов, заданий и прогресса курсов.
            </p>
          </div>
          <div className="shrink-0 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-3 text-center shadow-[3px_3px_0px_0px_#1C293C]">
            <Brain className="mx-auto h-6 w-6 text-white" />
            <p className="text-[10px] uppercase tracking-widest font-black text-white/80 mt-1">ИИ Анализ</p>
          </div>
        </div>
      </section>

      {/* Panel */}
      <Suspense
        fallback={
          <div className="flex items-center gap-3 border-2 border-[#1C293C] bg-[#FBFBF9] p-5 shadow-[4px_4px_0px_0px_#1C293C]">
            <Loader2 className="h-5 w-5 animate-spin text-[#432DD7]" />
            <span className="text-sm font-bold text-[#1C293C]/60">Загрузка тьютора...</span>
          </div>
        }
      >
        <AiTutorPanel />
      </Suspense>
    </div>
  );
}
