'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpenCheck, ChevronLeft, ChevronRight, Clock3, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChallengeItem } from '../../_components/types';
import { TheoryQuestionCard } from './theory-question-card';

type SubmitResult = {
  score: number;
  passed: boolean;
  evaluation: string;
};

type Props = {
  challenge: ChallengeItem;
  challengeId: string;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  onSubmit: () => Promise<void> | void;
  saving: boolean;
  error: string;
  result: SubmitResult | null;
  elapsedLabel: string;
};

export function TheoryChallengePanel({
  challenge,
  challengeId,
  answers,
  onAnswerChange,
  onSubmit,
  saving,
  error,
  result,
  elapsedLabel,
}: Props) {
  const [successOpen, setSuccessOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setCurrentSlide(0);
  }, [challenge.id]);

  useEffect(() => {
    if (!result) return;
    if (result.passed) {
      setSuccessOpen(true);
      setRetryOpen(false);
    } else {
      setRetryOpen(true);
      setSuccessOpen(false);
    }
  }, [result]);

  const answeredCount = useMemo(
    () => answers.filter((item) => item.trim().length > 0).length,
    [answers],
  );

  const totalQuestions = challenge.quizQuestions.length;
  const activeQuestion = challenge.quizQuestions[currentSlide] ?? null;

  function goPrev() {
    setCurrentSlide((value) => Math.max(0, value - 1));
  }

  function goNext() {
    setCurrentSlide((value) => Math.min(totalQuestions - 1, value + 1));
  }

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 lg:p-5 space-y-3">
          <Link href="/challenges" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour à la liste
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold leading-tight">{challenge.title}</h1>
            <span className="text-xs rounded-full border bg-background px-2.5 py-1">Exercice théorie</span>
          </div>

          <p className="text-sm text-muted-foreground">{challenge.description || 'Lis chaque question puis valide tes réponses.'}</p>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1"><BookOpenCheck className="h-3.5 w-3.5" /> {challenge.formationName}</span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1"><Clock3 className="h-3.5 w-3.5" /> {challenge.estimatedMinutes} min</span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1"><Target className="h-3.5 w-3.5" /> {answeredCount}/{totalQuestions} répondues</span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 font-mono">⏱ {elapsedLabel}</span>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 lg:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-medium">Mode Slide</p>
              <p className="text-xs text-muted-foreground">Une question à la fois, focus maximal.</p>
            </div>
            <Button onClick={onSubmit} disabled={saving || totalQuestions === 0 || answeredCount === 0}>
              <Sparkles className="h-4 w-4" /> {saving ? 'Correction...' : 'Soumettre'}
            </Button>
          </div>

          {totalQuestions === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune question pour ce challenge.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>Question {currentSlide + 1} / {totalQuestions}</p>
                <p>{answeredCount} réponse(s) complétée(s)</p>
              </div>

              <div className="rounded-2xl border bg-background p-3 md:p-5 min-h-[280px] flex items-center justify-center">
                <div className="w-full max-w-2xl">
                  {activeQuestion && (
                    <TheoryQuestionCard
                      key={`${activeQuestion.question}-${currentSlide}`}
                      index={currentSlide}
                      question={activeQuestion}
                      value={answers[currentSlide] || ''}
                      onChange={(value) => onAnswerChange(currentSlide, value)}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={goPrev} disabled={currentSlide === 0}>
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>

                <div className="flex items-center gap-1.5">
                  {challenge.quizQuestions.map((question, index) => {
                    const isActive = index === currentSlide;
                    const isAnswered = Boolean((answers[index] || '').trim());
                    return (
                      <button
                        key={`${question.question}-${index}`}
                        type="button"
                        onClick={() => setCurrentSlide(index)}
                        className={`h-2.5 w-2.5 rounded-full border transition-colors ${isActive ? 'bg-primary border-primary' : isAnswered ? 'bg-primary/30 border-primary/40' : 'bg-muted border-border hover:bg-accent'}`}
                        aria-label={`Aller à la question ${index + 1}`}
                      />
                    );
                  })}
                </div>

                <Button variant="outline" onClick={goNext} disabled={currentSlide === totalQuestions - 1}>
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>
      </div>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Excellent travail 🎉</DialogTitle>
            <DialogDescription>Tu as réussi ce challenge théorie.</DialogDescription>
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

          {result?.evaluation && (
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="text-muted-foreground whitespace-pre-wrap">{result.evaluation}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessOpen(false)}>Continuer</Button>
            <Link href={`/challenges/${challengeId}/resultat`}>
              <Button>Voir les détails</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retryOpen} onOpenChange={setRetryOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Continue, tu progresses 💪</DialogTitle>
            <DialogDescription>Relis les questions et ajuste tes réponses pour améliorer ton score.</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="font-medium">Score actuel: {result?.score ?? 0}/100</p>
            {result?.evaluation && <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{result.evaluation}</p>}
          </div>

          <DialogFooter>
            <Button onClick={() => setRetryOpen(false)}>Reprendre le challenge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
