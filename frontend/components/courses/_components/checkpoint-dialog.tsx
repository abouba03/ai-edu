'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Question } from './personalized-types';

type CheckpointDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel?: string;
  triggerClassName?: string;
  questions: Question[];
  currentQuizQuestion: Question | null;
  quizCompleted: boolean;
  currentQuizIndex: number;
  userAnswers: string[];
  answeredQuestions: number;
  quizLoading: boolean;
  canSubmitQuiz: boolean;
  isLastQuizQuestion: boolean;
  canAdvanceCurrentQuiz: boolean;
  quizScore: number | null;
  quizPassed: boolean;
  quizScorePercent: number;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  minimumToPass: number;
  onGenerateCheckpointQuiz: () => void;
  onSubmitCheckpointQuiz: () => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onSelectAnswer: (questionIndex: number, choice: string) => void;
  getQuestionTypeLabel: (question: Question) => 'Vrai/Faux' | 'QCM';
};

export default function CheckpointDialog({
  open,
  onOpenChange,
  triggerLabel = 'Lancer le checkpoint',
  triggerClassName = 'w-full h-9 text-xs',
  questions,
  currentQuizQuestion,
  quizCompleted,
  currentQuizIndex,
  userAnswers,
  answeredQuestions,
  quizLoading,
  canSubmitQuiz,
  isLastQuizQuestion,
  canAdvanceCurrentQuiz,
  quizScore,
  quizPassed,
  quizScorePercent,
  correctAnswersCount,
  wrongAnswersCount,
  minimumToPass,
  onGenerateCheckpointQuiz,
  onSubmitCheckpointQuiz,
  onPrevQuestion,
  onNextQuestion,
  onSelectAnswer,
  getQuestionTypeLabel,
}: CheckpointDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button id="checkpoint" className={triggerClassName}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Checkpoint IA</DialogTitle>
          <DialogDescription>
            Une question à la fois, feedback immédiat, progression visible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-background p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Progression</p>
              <p className="text-xs text-muted-foreground">
                {questions.length === 0
                  ? 'Génère les questions pour démarrer.'
                  : `${answeredQuestions}/${questions.length} réponse(s) complétée(s)`}
              </p>
            </div>
            <Button onClick={onGenerateCheckpointQuiz} disabled={quizLoading} className="h-9 text-xs">
              {quizLoading ? 'Génération...' : questions.length > 0 ? 'Régénérer 10 questions' : 'Générer 10 questions'}
            </Button>
          </div>

          {questions.length > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round((answeredQuestions / questions.length) * 100)}%` }}
              />
            </div>
          )}

          {questions.length > 0 && currentQuizQuestion && !quizCompleted && (
            <div className="space-y-4">
              <div className="rounded-md border bg-background p-3 overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentQuizIndex * 100}%)` }}
                >
                  {questions.map((q, i) => {
                    const selectedAnswer = userAnswers[i] ?? '';

                    return (
                      <div key={`${q.question}-${i}`} className="w-full shrink-0 px-1">
                        <div className="rounded-md border p-3 space-y-3 bg-background">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">Question {i + 1}/{questions.length}</p>
                              <p className="font-medium text-sm leading-snug">{q.question}</p>
                            </div>
                            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {getQuestionTypeLabel(q)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {q.choices.map((choice) => {
                              const isSelected = selectedAnswer === choice;
                              return (
                                <label
                                  key={`${q.question}-${choice}`}
                                  className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                                    isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    className="mt-0.5"
                                    name={`checkpoint-${i}`}
                                    value={choice}
                                    checked={isSelected}
                                    disabled={quizCompleted}
                                    onChange={() => onSelectAnswer(i, choice)}
                                  />
                                  <span className="text-sm leading-snug">{choice}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" disabled={currentQuizIndex === 0} onClick={onPrevQuestion} className="h-9 text-xs">
                  Précédent
                </Button>

                {isLastQuizQuestion ? (
                  <Button onClick={onSubmitCheckpointQuiz} disabled={!canSubmitQuiz} className="h-9 text-xs">
                    Terminer
                  </Button>
                ) : (
                  <Button onClick={onNextQuestion} disabled={!canAdvanceCurrentQuiz} className="h-9 text-xs">
                    Avancer
                  </Button>
                )}
              </div>
            </div>
          )}

          {questions.length > 0 && quizCompleted && quizScore !== null && (
            <div className="space-y-3">
              <div className={`rounded-md border p-4 space-y-3 ${quizPassed ? 'border-primary/30 bg-primary/10' : 'border-destructive/30 bg-destructive/10'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Résultat checkpoint</p>
                    <p className="text-base font-semibold mt-1">{quizPassed ? 'Checkpoint validé' : 'Checkpoint à renforcer'}</p>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-primary/30 bg-background px-2.5 py-1 text-xs font-semibold">
                    Score: {quizScorePercent}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">Questions</p>
                    <p className="text-sm font-semibold">{questions.length}</p>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">Correctes</p>
                    <p className="text-sm font-semibold text-primary">{correctAnswersCount}</p>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">À corriger</p>
                    <p className="text-sm font-semibold text-destructive">{wrongAnswersCount}</p>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">Minimum</p>
                    <p className="text-sm font-semibold">{minimumToPass}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const selectedAnswer = userAnswers[i] ?? '';
                  const isCorrect = selectedAnswer === q.answer;

                  return (
                    <div key={`checkpoint-result-${q.question}-${i}`} className={`rounded-md border p-3 space-y-2 ${isCorrect ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Question {i + 1}/{questions.length} • {getQuestionTypeLabel(q)}</p>
                          <p className="text-sm font-medium leading-snug">{q.question}</p>
                        </div>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            <CircleAlert className="h-3.5 w-3.5" /> À revoir
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-md border bg-background p-2">
                          <p className="text-[11px] text-muted-foreground">Ta réponse</p>
                          <p className="text-xs font-medium">{selectedAnswer || '—'}</p>
                        </div>
                        <div className="rounded-md border bg-background p-2">
                          <p className="text-[11px] text-muted-foreground">Bonne réponse</p>
                          <p className="text-xs font-medium">{q.answer}</p>
                        </div>
                      </div>

                      <div className="rounded-md border bg-background p-2">
                        <p className="text-[11px] text-muted-foreground">Explication</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end">
                <Button onClick={onGenerateCheckpointQuiz} disabled={quizLoading} className="h-9 text-xs">
                  {quizLoading ? 'Génération...' : 'Refaire un checkpoint'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
