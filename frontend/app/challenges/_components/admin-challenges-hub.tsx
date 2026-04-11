'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpenCheck, Clock3, Code2, Sparkles } from 'lucide-react';

type ChallengeItem = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  points: number;
  kind: 'code' | 'theory';
  estimatedMinutes: number;
  language: string;
  formationName: string;
  hints: string[];
  testCases: Array<{ label: string; input: string; expected: string }>;
  quizQuestions: Array<{ question: string; choices: string[]; answer: string; explanation: string }>;
};

type AttemptRow = {
  id: string;
  challengeId: string | null;
  challengeTitle: string | null;
  challengeKind: string;
  score: number | null;
  passed: boolean;
  createdAt: string;
};

export default function AdminChallengesHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; evaluation: string } | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    let mounted = true;

    async function loadChallenges() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/challenges', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || 'load_failed');
        }

        if (!mounted) return;
        const list = Array.isArray(data.challenges) ? data.challenges : [];
        setItems(list);

        if (list.length > 0) {
          setSelectedId(list[0].id);
        }
      } catch {
        if (mounted) {
          setError('Impossible de charger les challenges publiés.');
          setItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadChallenges();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setCode('');
    setAnswers(Array(selected.quizQuestions.length).fill(''));
    setResult(null);
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;

    async function loadAttempts() {
      try {
        const res = await fetch(`/api/challenges/attempts?challengeId=${selectedId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
      } catch {
        if (mounted) setAttempts([]);
      }
    }

    loadAttempts();
    return () => {
      mounted = false;
    };
  }, [selectedId, result]);

  async function submitCurrentChallenge() {
    if (!selected) return;

    if (selected.kind === 'code' && !code.trim()) {
      setError('Ajoute une solution avant de soumettre.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/challenges/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selected.kind === 'code'
            ? {
                challengeId: selected.id,
                kind: 'code',
                studentCode: code,
              }
            : {
                challengeId: selected.id,
                kind: 'theory',
                answers,
              },
        ),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'submit_failed');
      }

      setResult({
        score: Number(data.score ?? 0),
        passed: Boolean(data.passed),
        evaluation: String(data.evaluation ?? ''),
      });
    } catch {
      setError('Impossible de soumettre pour le moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[320px,1fr]">
      <aside className="rounded-2xl border bg-card p-3 space-y-2 max-h-[780px] overflow-auto">
        <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">Challenges publiés</p>
        {loading ? (
          <p className="text-sm text-muted-foreground px-1">Chargement...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Aucun challenge publié par l’admin.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selectedId === item.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
              }`}
            >
              <p className="font-medium text-sm line-clamp-1">{item.title}</p>
              <p className="text-xs opacity-80 mt-1">
                {item.kind === 'code' ? 'Code' : 'Théorie'} • {item.difficulty} • {item.estimatedMinutes} min
              </p>
            </button>
          ))
        )}
      </aside>

      <div className="space-y-4">
        {!selected ? (
          <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            Sélectionne un challenge dans la colonne gauche.
          </section>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <span className="text-xs rounded-full border bg-background px-2.5 py-1">
                  {selected.kind === 'code' ? 'Exercice code' : 'Exercice théorie'}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">{selected.description || 'Sans description.'}</p>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><BookOpenCheck className="size-3.5" /> {selected.formationName}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> {selected.estimatedMinutes} min</span>
                <span className="inline-flex items-center gap-1"><Code2 className="size-3.5" /> {selected.points} pts</span>
              </div>

              {selected.hints.length > 0 && (
                <div className="rounded-xl border bg-background p-3 text-sm space-y-1">
                  <p className="font-medium">Indices</p>
                  {selected.hints.map((hint, index) => (
                    <p key={`${hint}-${index}`} className="text-muted-foreground">• {hint}</p>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-medium">Résolution</p>

              {selected.kind === 'code' ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full min-h-56 rounded-xl border bg-background p-3 text-sm font-mono"
                    placeholder="Écris ta solution Python ici..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  {selected.testCases.length > 0 && (
                    <div className="rounded-xl border bg-background p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Cas de test (référence)</p>
                      {selected.testCases.map((test) => (
                        <p key={`${test.label}-${test.input}`}>{test.label}: input `{test.input}` → attendu `{test.expected}`</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selected.quizQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ce challenge théorie ne contient pas encore de questions.</p>
                  ) : (
                    selected.quizQuestions.map((question, index) => (
                      <div key={`${question.question}-${index}`} className="rounded-xl border bg-background p-3 space-y-2">
                        <p className="text-sm font-medium">{index + 1}. {question.question}</p>
                        {question.choices.length > 0 ? (
                          <div className="space-y-1 text-sm">
                            {question.choices.map((choice) => (
                              <label key={choice} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`q-${index}`}
                                  value={choice}
                                  checked={answers[index] === choice}
                                  onChange={() =>
                                    setAnswers((prev) => {
                                      const next = [...prev];
                                      next[index] = choice;
                                      return next;
                                    })
                                  }
                                />
                                <span>{choice}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            value={answers[index] ?? ''}
                            onChange={(e) =>
                              setAnswers((prev) => {
                                const next = [...prev];
                                next[index] = e.target.value;
                                return next;
                              })
                            }
                            placeholder="Ta réponse"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <Button onClick={submitCurrentChallenge} disabled={saving}>
                <Sparkles className="size-4" /> {saving ? 'Soumission...' : 'Soumettre ma réponse'}
              </Button>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {result && (
                <div className="rounded-xl border bg-background p-3 text-sm space-y-1">
                  <p className="font-medium">Résultat: {result.score}/100 {result.passed ? '✅' : '❌'}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{result.evaluation || 'Évaluation reçue.'}</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 space-y-2">
              <p className="text-sm font-medium">Mes dernières tentatives</p>
              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune tentative enregistrée pour ce challenge.</p>
              ) : (
                attempts.slice(0, 8).map((attempt) => (
                  <div key={attempt.id} className="rounded-lg border bg-background px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <p className="truncate">{attempt.challengeTitle || 'Exercice'}</p>
                    <p className={attempt.passed ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {typeof attempt.score === 'number' ? `${attempt.score}/100` : '--'}
                    </p>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
