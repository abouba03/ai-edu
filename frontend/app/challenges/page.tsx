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
      {/* Hero */}
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-6 shadow-[6px_6px_0px_0px_#1C293C]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest font-black text-[#432DD7]">Challenges Arena</p>
            <h1 className="text-3xl lg:text-4xl font-black text-[#1C293C] mt-1 leading-tight">
              Défis &amp; Classement
            </h1>
            <p className="text-[#1C293C]/60 mt-2 max-w-2xl text-sm font-medium">
              Relève les challenges publiés, améliore ton score et compare ta progression avec les autres apprenants.
            </p>
          </div>
          <div className="border-2 border-[#1C293C] bg-[#FDC800] px-6 py-4 text-center shadow-[4px_4px_0px_0px_#1C293C] shrink-0">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]">Progression</p>
            <p className="text-4xl font-black text-[#1C293C] mt-0.5">{progress}%</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-5">
          <article className="border-2 border-[#1C293C] bg-[#432DD7] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/70">Position actuelle</p>
            <p className="mt-1.5 font-black text-base inline-flex items-center gap-1.5 text-white">
              <Trophy className="h-4 w-4" /> Top en cours
            </p>
          </article>
          <article className="border-2 border-[#1C293C] bg-[#FDC800] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/70">Score total</p>
            <p className="mt-1.5 font-black text-base inline-flex items-center gap-1.5 text-[#1C293C]">
              <Star className="h-4 w-4" /> {totalScore} pts
            </p>
          </article>
          <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/70">Challenges faits</p>
            <p className="mt-1.5 font-black text-base inline-flex items-center gap-1.5 text-[#1C293C]">
              <Medal className="h-4 w-4" /> {completedCount}
            </p>
          </article>
          <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#1C293C]/70">Tentatives validées</p>
            <p className="mt-1.5 font-black text-base inline-flex items-center gap-1.5 text-[#1C293C]">
              <Target className="h-4 w-4" /> {passedCount}
            </p>
          </article>
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
