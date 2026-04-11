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
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Badges</p>
        <h2 className="text-lg font-semibold mt-1">Progression</h2>
      </div>

      <div className="space-y-2">
        {BADGE_RULES.map((rule) => {
          const unlocked = total >= rule.minAttempts && passRate >= rule.minPassRate;
          return (
            <article key={rule.key} className="rounded-xl border bg-background p-3 flex items-start gap-2">
              <div className={`mt-0.5 ${unlocked ? 'text-primary' : 'text-muted-foreground'}`}>
                {unlocked ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-medium">{rule.label}</p>
                <p className="text-xs text-muted-foreground">{rule.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
