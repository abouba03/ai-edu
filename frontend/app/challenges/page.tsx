"use client";

import { useEffect, useState } from 'react';
import { Medal, Star, Target, Trophy } from 'lucide-react';
import ChallengeList from './_components/challengeList';
import Classement from './_components/classement';
import BadgeList from './_components/BadgeList';
import { ChallengeAttemptRow, ChallengeItem } from './_components/types';

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [attempts, setAttempts] = useState<ChallengeAttemptRow[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [challengesRes, attemptsRes] = await Promise.all([
          fetch('/api/challenges', { cache: 'no-store' }),
          fetch('/api/challenges/attempts', { cache: 'no-store' }),
        ]);

        const [challengesData, attemptsData] = await Promise.all([
          challengesRes.json(),
          attemptsRes.json(),
        ]);

        if (!mounted) return;
        setChallenges(Array.isArray(challengesData?.challenges) ? challengesData.challenges : []);
        setAttempts(Array.isArray(attemptsData?.attempts) ? attemptsData.attempts : []);
      } catch {
        if (!mounted) return;
        setChallenges([]);
        setAttempts([]);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const completedChallengeIds = new Set(attempts.map((attempt) => attempt.challengeId).filter(Boolean));
  const completedCount = challenges.filter((challenge) => completedChallengeIds.has(challenge.id)).length;
  const progress = challenges.length > 0 ? Math.round((completedCount / challenges.length) * 100) : 0;
  const totalScore = attempts.reduce((sum, item) => sum + Number(item.score ?? 0), 0);
  const passedCount = attempts.filter((item) => item.passed).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="rounded-2xl border bg-background p-5 lg:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold">Challenges Arena</p>
              <h1 className="text-2xl lg:text-3xl font-bold mt-2">Défis & Classement</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Releve les challenges publiés, améliore ton score et compare ta progression avec les autres apprenants.
              </p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3 text-center min-w-36">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Progression</p>
              <p className="text-2xl font-extrabold text-primary mt-1">{progress}%</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <article className="rounded-xl border bg-card p-3">
              <p className="text-muted-foreground">Position actuelle</p>
              <p className="mt-1 font-semibold inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> Top en cours</p>
            </article>
            <article className="rounded-xl border bg-card p-3">
              <p className="text-muted-foreground">Score total</p>
              <p className="mt-1 font-semibold inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {totalScore} pts</p>
            </article>
            <article className="rounded-xl border bg-card p-3">
              <p className="text-muted-foreground">Challenges faits</p>
              <p className="mt-1 font-semibold inline-flex items-center gap-1"><Medal className="h-3.5 w-3.5" /> {completedCount}</p>
            </article>
            <article className="rounded-xl border bg-card p-3">
              <p className="text-muted-foreground">Tentatives validées</p>
              <p className="mt-1 font-semibold inline-flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {passedCount}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="order-1">
          <ChallengeList
          challenges={challenges}
          attempts={attempts}
          showAll={showAll}
          onToggleShowAll={() => setShowAll((prev) => !prev)}
          />
        </div>

        <aside className="order-2 space-y-4 lg:sticky lg:top-4 lg:h-fit">
          <Classement />
          <BadgeList attempts={attempts} />
        </aside>
      </section>
    </div>
  );
}
