'use client';

import { Award, Lock } from 'lucide-react';
import { BADGE_RULES } from './badges-data';
import { ChallengeAttemptRow } from './types';

type Props = {
  attempts: ChallengeAttemptRow[];
};

export default function BadgeList({ attempts }: Props) {
  const total = attempts.length;
  const passed = attempts.filter((item) => item.passed).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[5px_5px_0px_0px_#1C293C] space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Badges</p>
        <h2 className="text-xl font-black text-[#1C293C] mt-0.5">Progression</h2>
      </div>

      <div className="space-y-2">
        {BADGE_RULES.map((rule) => {
          const unlocked = total >= rule.minAttempts && passRate >= rule.minPassRate;
          return (
            <article
              key={rule.key}
              className={`border-2 border-[#1C293C] p-3 flex items-start gap-3 ${
                unlocked
                  ? 'bg-[#FDC800] shadow-[3px_3px_0px_0px_#1C293C]'
                  : 'bg-white opacity-60'
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${unlocked ? 'text-[#1C293C]' : 'text-[#1C293C]/40'}`}>
                {unlocked ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </div>
              <div>
                <p className={`text-sm font-black ${unlocked ? 'text-[#1C293C]' : 'text-[#1C293C]/60'}`}>
                  {rule.label}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${unlocked ? 'text-[#1C293C]/70' : 'text-[#1C293C]/40'}`}>
                  {rule.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
