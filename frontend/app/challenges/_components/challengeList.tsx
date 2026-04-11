import Link from 'next/link';
import { Clock3, Code2, Layers3, Sparkles, Trophy } from 'lucide-react';
import { ChallengeAttemptRow, ChallengeItem } from './types';
import { Button } from '@/components/ui/button';

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
    <section className="rounded-2xl border bg-card p-4 lg:p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Catalogue</p>
          <h2 className="text-lg font-semibold mt-1">Challenges disponibles</h2>
        </div>
        <span className="text-xs rounded-md border bg-background px-2 py-1">{challenges.length} challenges</span>
      </div>

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">Aucun challenge publié pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {available.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Challenges disponibles</p>
                <span className="text-[11px] rounded-full border bg-background px-2 py-0.5">{available.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleAvailable.map((item) => (
                  <article key={item.id} className="rounded-xl border bg-background p-3 space-y-2 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold line-clamp-1">{item.title}</h3>
                      <span className="text-[10px] rounded-full border bg-primary/10 text-primary px-2 py-0.5">Nouveau</span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description || 'Sans description.'}</p>

                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" /> {item.formationName}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.estimatedMinutes} min</span>
                      <span className="inline-flex items-center gap-1"><Code2 className="h-3.5 w-3.5" /> {item.points} pts</span>
                    </div>

                    <Link href={`/challenges/${item.id}`} className="inline-flex w-full justify-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-95">
                      Commencer le défi
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">Challenges complétés</p>
                <span className="text-[11px] rounded-full border bg-emerald-50 text-emerald-700 px-2 py-0.5">{completed.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleCompleted.map((item) => {
                  const myAttempt = attempts.find((attempt) => attempt.challengeId === item.id);
                  return (
                    <article key={item.id} className="rounded-xl border bg-background p-3 space-y-2 opacity-90 hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold line-clamp-1">{item.title}</h3>
                        <span className="text-[10px] rounded-full border bg-emerald-50 text-emerald-700 px-2 py-0.5">Terminé</span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description || 'Sans description.'}</p>

                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" /> {item.formationName}</span>
                        <span className="inline-flex items-center gap-1"><Code2 className="h-3.5 w-3.5" /> Score: {typeof myAttempt?.score === 'number' ? `${myAttempt.score}/100` : '--'}</span>
                      </div>

                      <Link href={`/challenges/${item.id}/resultat`} className="inline-flex w-full justify-center rounded-md border bg-card px-3 py-2 text-xs font-medium hover:bg-accent">
                        Voir les résultats
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {challenges.length > maxVisible && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={onToggleShowAll}>
                {showAll ? 'Réduire la liste' : `Voir tous les challenges (${challenges.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
