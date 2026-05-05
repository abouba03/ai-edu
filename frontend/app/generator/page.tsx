import Link from 'next/link';
import { ArrowRight, Brain, Code2, FileCode2 } from 'lucide-react';

export default function GeneratorPage() {
  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-[#F5F5F0] p-2 sm:p-3">
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] px-4 py-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Модуль ИИ</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-[#1C293C] sm:text-3xl">
              Центр генератора
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#1C293C]/65">
              Выбери нужный режим: сгенерировать код по твоему запросу
              или получить персональное упражнение для тренировки.
            </p>
          </div>
          <div className="shrink-0 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-3 text-center shadow-[3px_3px_0px_0px_#1C293C]">
            <Brain className="mx-auto h-6 w-6 text-white" />
            <p className="mt-1 text-[10px] uppercase tracking-widest font-black text-white/85">ИИ помощник</p>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        <article className="group flex h-full flex-col border-2 border-[#1C293C] bg-white p-4 shadow-[4px_4px_0px_0px_#1C293C] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[6px_6px_0px_0px_#1C293C]">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Режим 01</p>
          <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2">
            <Code2 className="h-4 w-4" /> Генерация кода
          </h2>
          <p className="text-sm font-medium text-[#1C293C]/65">
            Напиши свободный запрос и получи готовый Python-код под твою задачу.
          </p>
          <Link
            href="/generator/code"
            className="mt-auto inline-flex items-center justify-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] transition-all duration-100 group-hover:shadow-[2px_2px_0px_0px_#1C293C]"
          >
            Открыть генератор кода
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="group flex h-full flex-col border-2 border-[#1C293C] bg-white p-4 shadow-[4px_4px_0px_0px_#1C293C] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[6px_6px_0px_0px_#1C293C]">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Режим 02</p>
          <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2">
            <FileCode2 className="h-4 w-4" /> Персональное упражнение
          </h2>
          <p className="text-sm font-medium text-[#1C293C]/65">
            Система автоматически подбирает задание по твоему прогрессу,
            чтобы проверить знания и найти слабые места.
          </p>
          <Link
            href="/generator/exercise"
            className="mt-auto inline-flex items-center justify-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0px_0px_#1C293C] transition-all duration-100 group-hover:shadow-[2px_2px_0px_0px_#1C293C]"
          >
            Открыть персональные упражнения
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>
    </div>
  );
}
