'use client';

import { Flame, Star, Trophy, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { ExerciseStats } from './types';

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Начальный',
  intermediaire: 'Средний',
  avance: 'Продвинутый',
};

const LEVEL_COLORS: Record<string, string> = {
  debutant: 'bg-[#22C55E] text-white',
  intermediaire: 'bg-[#432DD7] text-white',
  avance: 'bg-[#DC2626] text-white',
};

const LEVEL_CONCEPT_HINTS: Record<number, string[]> = {
  1:  ['Переменные', 'Типы данных', 'print()', 'input()'],
  2:  ['if/else', 'Логика', 'Преобразование типов'],
  3:  ['Цикл for', 'Цикл while', 'Списки', 'break/continue'],
  4:  ['Функции', 'return', 'Область видимости', 'Рекурсия'],
  5:  ['Срезы', 'List comprehension', 'Словари', 'Кортежи'],
  6:  ['Строки', 'Файлы', 'try/except'],
  7:  ['Классы', 'Наследование', 'Специальные методы'],
  8:  ['Сортировка', 'Поиск', 'Сложность алгоритмов'],
  9:  ['Декораторы', 'Генераторы', 'Итераторы'],
  10: ['Паттерны', 'Оптимизация', 'Структуры данных'],
};

type Props = {
  stats: ExerciseStats | null;
  loading: boolean;
  difficultyChange?: number | null;
  levelUp?: boolean;
  concepts?: string[];
};

export default function ExerciseTopBar({ stats, loading, difficultyChange, levelUp, concepts = [] }: Props) {
  const level = stats?.level ?? 'debutant';
  const difficulty = stats?.difficulty ?? 1;
  const totalPoints = stats?.totalPoints ?? 0;
  const passedCount = stats?.passedCount ?? 0;
  const failedCount = stats?.failedCount ?? 0;
  const consecutiveWins = stats?.consecutiveWins ?? 0;
  const nextLevelPoints = stats?.nextLevelPoints ?? null;
  const nextLevelPassed = stats?.nextLevelPassed ?? null;

  const progressPct = nextLevelPoints
    ? Math.min(100, Math.round((totalPoints / nextLevelPoints) * 100))
    : 100;

  const difficultyStars = Array.from({ length: 10 }, (_, i) => i < difficulty);
  const conceptsToShow = concepts.length > 0
    ? concepts.slice(0, 4)
    : (LEVEL_CONCEPT_HINTS[difficulty] ?? LEVEL_CONCEPT_HINTS[1]).slice(0, 4);

  return (
    <div className="border-b-2 border-[#1C293C] bg-[#FBFBF9] px-4 py-3 flex flex-wrap items-center gap-3">
      {/* Titre */}
      <div className="flex items-center gap-2 mr-auto">
        <Zap className="h-5 w-5 text-[#432DD7]" />
        <span className="text-sm font-black text-[#1C293C] uppercase tracking-wider">
          Адаптивные упражнения
        </span>
      </div>

      {loading ? (
        <div className="h-7 w-48 bg-gray-200 animate-pulse rounded" />
      ) : (
        <>
          {/* Niveau */}
          <div className={`px-3 py-1 text-xs font-black border-2 border-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] ${LEVEL_COLORS[level]}`}>
            <Trophy className="h-3.5 w-3.5 inline mr-1" />
            {LEVEL_LABELS[level]}
            {levelUp && (
              <span className="ml-1.5 animate-bounce text-[#FDC800]">▲ НОВЫЙ УРОВЕНЬ!</span>
            )}
          </div>

          {/* Points */}
          <div className="flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-1 shadow-[2px_2px_0px_0px_#1C293C]">
            <Star className="h-3.5 w-3.5 text-[#FDC800]" />
            <span className="text-xs font-black text-[#1C293C]">{totalPoints} очк.</span>
            {nextLevelPoints && (
              <>
                <div className="w-24 h-2 bg-gray-200 border border-[#1C293C] overflow-hidden">
                  <div
                    className="h-full bg-[#432DD7] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500">{nextLevelPoints} для след. уровня</span>
              </>
            )}
          </div>

          {/* Difficulté */}
          <div className="flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1 shadow-[2px_2px_0px_0px_#1C293C]">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Сложн.</span>
            <span className="flex gap-0.5">
              {difficultyStars.map((filled, i) => (
                <span
                  key={i}
                  className={`text-[10px] ${filled ? 'text-[#FDC800]' : 'text-gray-300'}`}
                >
                  ★
                </span>
              ))}
            </span>
            <span className="text-xs font-black text-[#1C293C]">{difficulty}/10</span>
            {difficultyChange !== undefined && difficultyChange !== null && difficultyChange !== 0 && (
              <span className={`text-[10px] font-bold ${difficultyChange > 0 ? 'text-[#22C55E]' : 'text-[#DC2626]'}`}>
                {difficultyChange > 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                {difficultyChange > 0 ? '+' : ''}{difficultyChange}
              </span>
            )}
          </div>

          {/* Streak */}
          {consecutiveWins > 1 && (
            <div className="flex items-center gap-1 border-2 border-[#FDC800] bg-[#FDC800] px-3 py-1 shadow-[2px_2px_0px_0px_#1C293C]">
              <Flame className="h-3.5 w-3.5 text-[#1C293C]" />
              <span className="text-xs font-black text-[#1C293C]">{consecutiveWins} подряд</span>
            </div>
          )}

          {/* Stats rapides */}
          <div className="text-[10px] text-gray-500 font-semibold">
            ✅ {passedCount} &nbsp; ❌ {failedCount}
            {nextLevelPassed && (
              <span className="ml-1">— еще {nextLevelPassed - passedCount} успехов до след. уровня</span>
            )}
          </div>
        </>
      )}

      {/* Passive concept chips for the currently generated challenge */}
      {!loading && (
        <div className="w-full border-t border-[#1C293C]/10 pt-2 mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black text-[#1C293C]/50 uppercase tracking-wider shrink-0">
            Концепты задания:
          </span>
          {conceptsToShow.map((concept) => (
            <span
              key={concept}
              className="px-2 py-0.5 text-[10px] font-bold border border-[#1C293C]/20 bg-white text-[#1C293C]/75"
            >
              {concept}
            </span>
          ))}
          <span className="text-[10px] text-[#1C293C]/35 italic">авто (по уровню и генерации)</span>
        </div>
      )}
    </div>
  );
}
