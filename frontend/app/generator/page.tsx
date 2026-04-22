import Link from 'next/link';
import { ArrowRight, Brain, Code2, FileCode2 } from 'lucide-react';

export default function GeneratorPage() {
  return (
    <div className="space-y-4">
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] px-4 py-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest font-black text-[#432DD7]">Модуль ИИ</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-[#1C293C] lg:text-3xl">
              Центр генерации
            </h1>
            <p className="mt-1.5 max-w-xl text-xs font-medium text-[#1C293C]/60 sm:text-sm">
              Выбери нужный сценарий: генерация кода по запросу или персонализированное упражнение
              для проверки знаний и выявления трудностей.
            </p>
          </div>
          <div className="shrink-0 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-3 text-center shadow-[3px_3px_0px_0px_#1C293C]">
            <Brain className="mx-auto h-6 w-6 text-white" />
            <p className="text-[10px] uppercase tracking-widest font-black text-white/80 mt-1">ИИ Анализ</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Feature 01</p>
          <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2">
            <Code2 className="h-4 w-4" /> Générer du code
          </h2>
          <p className="text-sm font-medium text-[#1C293C]/65">
            Donne un prompt libre et obtiens un code Python adapté à ton besoin.
          </p>
          <Link
            href="/generator/code"
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C]"
          >
            Ouvrir la génération de code
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Feature 02</p>
          <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2">
            <FileCode2 className="h-4 w-4" /> Générer un exercice personnalisé
          </h2>
          <p className="text-sm font-medium text-[#1C293C]/65">
            L&apos;exercice est généré automatiquement selon l&apos;historique en base pour tester les connaissances
            et détecter les difficultés actuelles.
          </p>
          <Link
            href="/generator/exercise"
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0px_0px_#1C293C]"
          >
            Ouvrir les exercices personnalisés
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>
    </div>
  );
}
