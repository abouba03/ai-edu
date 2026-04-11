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
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Classement</p>
        <h2 className="text-lg font-semibold mt-1">Top 30 jours</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de classement.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
          {rows.slice(0, 8).map((row, index) => (
            <article key={row.clerkId} className="rounded-lg border bg-background px-2.5 py-2 text-xs flex items-center justify-between gap-2">
              <p className="truncate inline-flex items-center gap-1.5">
                {index === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-500" /> : <Medal className="h-3.5 w-3.5 text-muted-foreground" />}
                {row.displayName}
              </p>
              <p className="font-medium">{row.totalPoints} pts</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
