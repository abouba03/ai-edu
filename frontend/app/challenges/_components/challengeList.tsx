import Link from 'next/link';
import { Clock3, Code2, Layers3, Sparkles, Trophy } from 'lucide-react';
import { ChallengeAttemptRow, ChallengeItem } from './types';

type Props = {
  challenges: ChallengeItem[];
  attempts: ChallengeAttemptRow[];
  showAll: boolean;
  onToggleShowAll: () => void;
};

export default function ChallengeList({ challenges, attempts, showAll, onToggleShowAll }: Props) {
  const completedIds = new Set(attempts.map((item) => item.challengeId).filter(Boolean));
  const available = challenges.filter((item) => !completedIds.has(item.id));
  const completed = challenges.filter((item) => completedIds.has(item.id));

  const maxVisible = 4;
  const visibleAvailable = showAll ? available : available.slice(0, maxVisible);
  const visibleCompleted = showAll ? completed : completed.slice(0, Math.max(0, maxVisible - visibleAvailable.length));

  return (
    <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-5 shadow-[5px_5px_0px_0px_#1C293C] space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Каталог</p>
          <h2 className="text-xl font-black text-[#1C293C] mt-0.5">Доступные задания</h2>
        </div>
        <span className="border-2 border-[#1C293C] bg-[#FDC800] px-2.5 py-1 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
          {challenges.length} заданий
        </span>
      </div>

      {challenges.length === 0 ? (
        <div className="border-2 border-dashed border-[#1C293C]/40 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#1C293C]/50">Задания пока не опубликованы.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {available.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#432DD7]" />
                <p className="text-sm font-black text-[#1C293C]">К выполнению</p>
                <span className="border border-[#1C293C] bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">
                  {available.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleAvailable.map((item) => (
                  <article
                    key={item.id}
                    className="border-2 border-[#1C293C] bg-white p-4 space-y-3 shadow-[4px_4px_0px_0px_#1C293C] hover:shadow-[2px_2px_0px_0px_#1C293C] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-[#1C293C] line-clamp-1">{item.title}</h3>
                      <span className="shrink-0 border border-[#1C293C] bg-[#FDC800] px-2 py-0.5 text-[10px] font-black text-[#1C293C]">
                        Новое
                      </span>
                    </div>

                    <p className="text-xs text-[#1C293C]/60 font-medium line-clamp-2">
                      {item.description || 'Без описания.'}
                    </p>

                    <div className="text-[11px] text-[#1C293C]/70 font-semibold flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" /> {item.formationName}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.estimatedMinutes} min</span>
                      <span className="inline-flex items-center gap-1"><Code2 className="h-3.5 w-3.5" /> {item.points} pts</span>
                    </div>

                    <Link
                      href={`/challenges/${item.id}`}
                      className="inline-flex w-full justify-center border-2 border-[#1C293C] bg-[#FDC800] px-3 py-2 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100"
                    >
                      Начать задание
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#16A34A]" />
                <p className="text-sm font-black text-[#16A34A]">Выполнено</p>
                <span className="border border-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
                  {completed.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleCompleted.map((item) => {
                  const myAttempt = attempts.find((attempt) => attempt.challengeId === item.id);
                  return (
                    <article
                      key={item.id}
                      className="border-2 border-[#1C293C] bg-white p-4 space-y-3 shadow-[4px_4px_0px_0px_#1C293C] hover:shadow-[2px_2px_0px_0px_#1C293C] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black text-[#1C293C] line-clamp-1">{item.title}</h3>
                        <span className="shrink-0 border border-[#16A34A] bg-[#16A34A] px-2 py-0.5 text-[10px] font-black text-white">
                          Завершено
                        </span>
                      </div>

                      <p className="text-xs text-[#1C293C]/60 font-medium line-clamp-2">
                        {item.description || 'Без описания.'}
                      </p>

                      <div className="text-[11px] text-[#1C293C]/70 font-semibold flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" /> {item.formationName}</span>
                        <span className="inline-flex items-center gap-1">
                          <Code2 className="h-3.5 w-3.5" /> Score: {typeof myAttempt?.score === 'number' ? `${myAttempt.score}/100` : '--'}
                        </span>
                      </div>

                      <Link
                        href={`/challenges/${item.id}/resultat`}
                        className="inline-flex w-full justify-center border-2 border-[#1C293C] bg-white px-3 py-2 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100"
                      >
                        Посмотреть результаты
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {challenges.length > maxVisible && (
            <div className="flex justify-center">
              <button
                onClick={onToggleShowAll}
                className="border-2 border-[#1C293C] bg-[#FBFBF9] px-5 py-2.5 text-sm font-black text-[#1C293C] shadow-[4px_4px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all duration-100"
              >
                {showAll ? 'Свернуть список' : `Показать все задания (${challenges.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
