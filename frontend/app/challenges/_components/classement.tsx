'use client';

import { useEffect, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';

type ClassementRow = {
  clerkId: string;
  displayName: string;
  totalPoints: number;
  attempts: number;
  passRate: number;
};

export default function Classement() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassementRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/challenges/classement?days=30', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setRows(Array.isArray(data?.leaderboard) ? data.leaderboard : []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[5px_5px_0px_0px_#1C293C] space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Рейтинг</p>
        <h2 className="text-xl font-black text-[#1C293C] mt-0.5">Топ за 30 дней</h2>
      </div>

      {loading ? (
        <p className="text-sm font-semibold text-[#1C293C]/50">Загрузка...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm font-semibold text-[#1C293C]/50">Рейтинг пока недоступен.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
          {rows.slice(0, 8).map((row, index) => (
            <article
              key={row.clerkId}
              className={`px-3 py-2 text-xs flex items-center justify-between gap-2 border-2 border-[#1C293C] font-bold ${
                index === 0
                  ? 'bg-[#FDC800] shadow-[3px_3px_0px_0px_#1C293C]'
                  : index === 1
                  ? 'bg-[#432DD7] text-white shadow-[2px_2px_0px_0px_#1C293C]'
                  : 'bg-white'
              }`}
            >
              <p className={`truncate inline-flex items-center gap-1.5 ${index === 1 ? 'text-white' : 'text-[#1C293C]'}`}>
                {index === 0 ? (
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Medal className={`h-3.5 w-3.5 shrink-0 ${index === 1 ? 'text-white/70' : 'text-[#1C293C]/40'}`} />
                )}
                <span className="font-black mr-1 shrink-0">{index + 1}.</span>
                {row.displayName}
              </p>
              <p className={`font-black shrink-0 ${index === 1 ? 'text-white' : 'text-[#1C293C]'}`}>
                {row.totalPoints} pts
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
