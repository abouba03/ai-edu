'use client';

import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Trophy, X } from 'lucide-react';
import type { SubmitResult } from './types';

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Начальный',
  intermediaire: 'Средний',
  avance: 'Продвинутый',
};

type Props = {
  result: SubmitResult;
  onClose: () => void;
  onNewChallenge: () => void;
};

export default function ExerciseResultModal({ result, onClose, onNewChallenge }: Props) {
  const { score, passed, pointsDelta, stats, levelUp, difficultyChange, evaluationJson } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[8px_8px_0px_0px_#1C293C] overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b-2 border-[#1C293C] ${passed ? 'bg-[#22C55E]' : 'bg-[#DC2626]'}`}>
          <div className="flex items-center gap-2">
            {passed
              ? <CheckCircle2 className="h-6 w-6 text-white" />
              : <XCircle className="h-6 w-6 text-white" />
            }
            <span className="text-white font-black text-xl">
              {passed ? 'Задача решена!' : 'Пока не решено...'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Score */}
        <div className="px-5 py-4 space-y-4">
          {/* Score bar */}
          <div>
            <div className="flex justify-between text-sm font-black text-[#1C293C] mb-1">
              <span>Оценка</span>
              <span>{score}/100</span>
            </div>
            <div className="h-4 bg-gray-200 border-2 border-[#1C293C] overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${score >= 60 ? 'bg-[#22C55E]' : 'bg-[#DC2626]'}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Points */}
          <div className={`flex items-center gap-2 border-2 border-[#1C293C] p-3 shadow-[3px_3px_0px_0px_#1C293C] ${pointsDelta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            {pointsDelta >= 0
              ? <TrendingUp className="h-5 w-5 text-[#22C55E]" />
              : <TrendingDown className="h-5 w-5 text-[#DC2626]" />
            }
            <div>
              <p className="font-black text-[#1C293C] text-sm">
                {pointsDelta >= 0 ? `+${pointsDelta}` : pointsDelta} очков
              </p>
              <p className="text-xs text-gray-500">Итого: {stats.totalPoints} очк.</p>
            </div>
          </div>

          {/* Level up */}
          {levelUp && (
            <div className="border-2 border-[#FDC800] bg-[#FDC800] p-3 shadow-[3px_3px_0px_0px_#1C293C] text-center">
              <Trophy className="h-6 w-6 mx-auto mb-1 text-[#1C293C]" />
              <p className="font-black text-[#1C293C] text-sm">
                🎉 Новый уровень: {LEVEL_LABELS[stats.level]}!
              </p>
            </div>
          )}

          {/* Difficulté */}
          {difficultyChange !== 0 && (
            <p className={`text-sm font-semibold ${difficultyChange > 0 ? 'text-[#22C55E]' : 'text-[#DC2626]'}`}>
              {difficultyChange > 0
                ? `↑ Сложность повышена до ${stats.difficulty}/10`
                : `↓ Сложность снижена до ${stats.difficulty}/10`
              }
            </p>
          )}

          {/* Commentaire IA */}
          {evaluationJson?.commentaire && (
            <div className="border-2 border-[#1C293C] p-3 bg-white shadow-[2px_2px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1.5">Комментарий</p>
              <p className="text-sm text-[#1C293C] leading-relaxed">{evaluationJson.commentaire}</p>
            </div>
          )}

          {/* Progression vers niveau suivant */}
          {stats.nextLevelPoints && !levelUp && (
            <p className="text-xs text-gray-500 text-center">
              До следующего уровня не хватает {stats.nextLevelPoints - stats.totalPoints} очков
              {stats.nextLevelPassed && ` · еще ${Math.max(0, stats.nextLevelPassed - stats.passedCount)} успешных решений`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border-2 border-[#1C293C] bg-white py-2.5 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100"
          >
            Смотреть детали
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onNewChallenge(); }}
            className="flex-1 border-2 border-[#1C293C] bg-[#432DD7] py-2.5 text-sm font-black text-white shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100"
          >
            Следующая задача →
          </button>
        </div>
      </div>
    </div>
  );
}
