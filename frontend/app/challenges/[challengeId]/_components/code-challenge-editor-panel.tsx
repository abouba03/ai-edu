'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { BookOpenCheck, Clock3, Code2, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChallengeItem } from '../../_components/types';

type SubmitResult = {
  score: number;
  passed: boolean;
  evaluation: string;
  motivationalMessage?: string | null;
  evaluationJson?: {
    note?: string | number;
    commentaire?: string;
    comment?: string;
    motivational_message?: string;
    consignes?: string[];
    idees?: string[];
    prochaines_etapes?: string[];
    test_summary?: {
      passed?: number;
      total?: number;
      all_passed?: boolean;
      runtime_error?: string;
    };
  } | null;
};

type Props = {
  challenge: ChallengeItem;
  challengeId: string;
  code: string;
  onCodeChange: (value: string) => void;
  onOpenDebuggerTab: () => void;
  elapsedLabel: string;
  saving: boolean;
  onSubmit: () => Promise<void> | void;
  error: string;
  result: SubmitResult | null;
};

export function CodeChallengeEditorPanel({
  challenge,
  challengeId,
  code,
  onCodeChange,
  onOpenDebuggerTab,
  elapsedLabel,
  saving,
  onSubmit,
  error,
  result,
}: Props) {
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [encouragementModalOpen, setEncouragementModalOpen] = useState(false);

  const isPerfectSuccess = useMemo(() => {
    if (!result?.passed) return false;
    const summary = result.evaluationJson?.test_summary;
    if (summary && typeof summary.all_passed === 'boolean') {
      return summary.all_passed;
    }
    return result.score >= 100;
  }, [result]);

  const testsLine = useMemo(() => {
    const summary = result?.evaluationJson?.test_summary;
    if (!summary) return null;
    const passed = Number(summary.passed ?? 0);
    const total = Number(summary.total ?? 0);
    return `${passed}/${total} tests validés`;
  }, [result]);

  const motivationalText = useMemo(() => {
    const fromJson = result?.evaluationJson?.motivational_message;
    if (typeof fromJson === 'string' && fromJson.trim()) return fromJson.trim();
    if (typeof result?.motivationalMessage === 'string' && result.motivationalMessage.trim()) {
      return result.motivationalMessage.trim();
    }
    return null;
  }, [result]);

  const evaluationSummary = useMemo(() => {
    const payload = result?.evaluationJson;
    if (!payload) {
      return {
        note: null as string | null,
        comment: result?.evaluation || '',
        consignes: [] as string[],
        idees: [] as string[],
        nextSteps: [] as string[],
      };
    }

    const noteRaw = payload.note;
    const note = noteRaw === undefined || noteRaw === null ? null : String(noteRaw);

    return {
      note,
      comment: String(payload.commentaire || payload.comment || result?.evaluation || '').trim(),
      consignes: Array.isArray(payload.consignes) ? payload.consignes.filter((item): item is string => typeof item === 'string') : [],
      idees: Array.isArray(payload.idees) ? payload.idees.filter((item): item is string => typeof item === 'string') : [],
      nextSteps: Array.isArray(payload.prochaines_etapes)
        ? payload.prochaines_etapes.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }, [result]);

  useEffect(() => {
    if (!result) return;

    if (isPerfectSuccess) {
      setSuccessModalOpen(true);
      setEncouragementModalOpen(false);
    } else {
      setSuccessModalOpen(false);
      setEncouragementModalOpen(true);
    }
  }, [isPerfectSuccess, result]);

  return (
    <>
      <div className="xl:col-span-8 rounded-xl border bg-background p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold leading-tight">{challenge.title}</h1>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><BookOpenCheck className="h-3.5 w-3.5" /> {challenge.formationName}</span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><Clock3 className="h-3.5 w-3.5" /> {challenge.estimatedMinutes} min</span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><Code2 className="h-3.5 w-3.5" /> {challenge.points} pts</span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 font-mono">⏱ {elapsedLabel}</span>
            </div>
          </div>

          <Button onClick={onSubmit} disabled={saving || !code.trim()}>
            <Sparkles className="h-4 w-4" /> {saving ? 'Soumission...' : 'Soumettre la solution'}
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Editor
            height="420px"
            defaultLanguage="python"
            value={code}
            onChange={(value) => onCodeChange(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              lineNumbersMinChars: 3,
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="relative overflow-hidden rounded-xl border bg-card p-4">
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute left-6 top-5 text-lg animate-bounce">✨</span>
                <span className="absolute right-10 top-6 text-lg animate-pulse">🎉</span>
                <span className="absolute left-1/2 -translate-x-1/2 bottom-4 text-lg animate-bounce">🏆</span>
              </div>
              <div className="relative flex items-center gap-3">
                <div className="rounded-full border bg-background p-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle>Excellent travail 🎉</DialogTitle>
                  <DialogDescription>Tu as validé ce challenge avec succès.</DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Score</p>
              <p className="text-sm font-semibold">{result?.score ?? 0}/100</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Temps</p>
              <p className="text-sm font-semibold font-mono">{elapsedLabel}</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Points</p>
              <p className="text-sm font-semibold">+{challenge.points}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium">{testsLine || 'Tous les tests sont validés.'}</p>
              {evaluationSummary.note && (
                <span className="rounded-full border px-2 py-0.5 text-xs">Note: {evaluationSummary.note}</span>
              )}
            </div>
            {evaluationSummary.comment && (
              <p className="text-muted-foreground">{evaluationSummary.comment}</p>
            )}
            {motivationalText && (
              <p className="rounded-md border bg-background px-2 py-1 text-xs text-primary">{motivationalText}</p>
            )}
          </div>

          {(evaluationSummary.consignes.length > 0 || evaluationSummary.idees.length > 0 || evaluationSummary.nextSteps.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border bg-card p-2 space-y-1">
                <p className="font-semibold">Consignes</p>
                {evaluationSummary.consignes.length === 0 ? (
                  <p className="text-muted-foreground">Aucune</p>
                ) : (
                  evaluationSummary.consignes.slice(0, 2).map((item, index) => (
                    <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                  ))
                )}
              </div>

              <div className="rounded-lg border bg-card p-2 space-y-1">
                <p className="font-semibold">Idées</p>
                {evaluationSummary.idees.length === 0 ? (
                  <p className="text-muted-foreground">Aucune</p>
                ) : (
                  evaluationSummary.idees.slice(0, 2).map((item, index) => (
                    <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                  ))
                )}
              </div>

              <div className="rounded-lg border bg-card p-2 space-y-1">
                <p className="font-semibold">Prochaines étapes</p>
                {evaluationSummary.nextSteps.length === 0 ? (
                  <p className="text-muted-foreground">Aucune</p>
                ) : (
                  evaluationSummary.nextSteps.slice(0, 2).map((item, index) => (
                    <p key={`${item}-${index}`} className="text-muted-foreground">• {item}</p>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-card p-2">
            <p className="text-[11px] text-muted-foreground">Challenge: {challenge.title}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessModalOpen(false)}>Continuer à coder</Button>
            <Link href={`/challenges/${challengeId}/resultat`}>
              <Button>Voir les détails</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={encouragementModalOpen} onOpenChange={setEncouragementModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="rounded-xl border bg-card p-4">
              <DialogTitle>Tu progresses bien 💪</DialogTitle>
              <DialogDescription>
                Le challenge n’est pas encore validé, mais tu es proche. Passe au debugger pour corriger rapidement.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Score actuel</p>
              <p className="text-sm font-semibold">{result?.score ?? 0}/100</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Temps</p>
              <p className="text-sm font-semibold font-mono">{elapsedLabel}</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-muted-foreground">Objectif</p>
              <p className="text-sm font-semibold">Valider tous les tests</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="text-muted-foreground line-clamp-4">{result?.evaluation || 'Regarde les tests et utilise le debugger pour avancer.'}</p>
            {motivationalText && (
              <p className="mt-2 rounded-md border bg-background px-2 py-1 text-xs text-primary">{motivationalText}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEncouragementModalOpen(false)}>Continuer</Button>
            <Button
              onClick={() => {
                setEncouragementModalOpen(false);
                onOpenDebuggerTab();
              }}
            >
              Ouvrir le Debugger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
