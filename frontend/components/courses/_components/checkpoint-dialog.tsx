'use client';

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
        <button id="checkpoint" className={triggerClassName}>{triggerLabel}</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl rounded-none border-2 border-[#1C293C] p-0 gap-0">
        <DialogHeader className="border-b-2 border-[#1C293C] px-5 py-4">
          <DialogTitle className="font-black text-[#1C293C]">Checkpoint IA</DialogTitle>
          <DialogDescription className="text-xs font-medium text-[#1C293C]/55">
            Une question à la fois, feedback immédiat, progression visible.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Génération + progression */}
          <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#1C293C]">Progression</p>
              <p className="text-[11px] font-medium text-[#1C293C]/55 mt-0.5">
                {questions.length === 0
                  ? 'Génère les questions pour démarrer.'
                  : `${answeredQuestions}/${questions.length} réponse(s) complétée(s)`}
              </p>
            </div>
            <button
              onClick={onGenerateCheckpointQuiz}
              disabled={quizLoading}
              className="border-2 border-[#1C293C] bg-[#FDC800] px-3 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {quizLoading ? 'Génération...' : questions.length > 0 ? 'Régénérer 10 questions' : 'Générer 10 questions'}
            </button>
          </div>

          {questions.length > 0 && (
            <div className="h-1.5 border border-[#1C293C]/30 bg-white overflow-hidden">
              <div
                className="h-full bg-[#1C293C] transition-all duration-300"
                style={{ width: `${Math.round((answeredQuestions / questions.length) * 100)}%` }}
              />
            </div>
          )}

          {/* Questions slider */}
          {questions.length > 0 && currentQuizQuestion && !quizCompleted && (
            <div className="space-y-3">
              <div className="border-2 border-[#1C293C] bg-white overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentQuizIndex * 100}%)` }}
                >
                  {questions.map((q, i) => {
                    const selectedAnswer = userAnswers[i] ?? '';
                    return (
                      <div key={`${q.question}-${i}`} className="w-full shrink-0 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                              Question {i + 1}/{questions.length}
                            </p>
                            <p className="font-black text-sm text-[#1C293C] leading-snug">{q.question}</p>
                          </div>
                          <span className="border border-[#1C293C]/30 px-2 py-0.5 text-[10px] font-bold text-[#1C293C]/60 shrink-0">
                            {getQuestionTypeLabel(q)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {q.choices.map((choice) => {
                            const isSelected = selectedAnswer === choice;
                            return (
                              <label
                                key={`${q.question}-${choice}`}
                                className={`flex items-start gap-2.5 border-2 px-3 py-2.5 cursor-pointer transition-all duration-100 ${
                                  isSelected
                                    ? 'border-[#1C293C] bg-[#FDC800]'
                                    : 'border-[#1C293C]/30 bg-white hover:border-[#1C293C] hover:bg-[#FBFBF9]'
                                }`}
                              >
                                <input
                                  type="radio"
                                  className="mt-0.5 shrink-0"
                                  name={`checkpoint-${i}`}
                                  value={choice}
                                  checked={isSelected}
                                  disabled={quizCompleted}
                                  onChange={() => onSelectAnswer(i, choice)}
                                />
                                <span className="text-sm font-medium text-[#1C293C] leading-snug">{choice}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  disabled={currentQuizIndex === 0}
                  onClick={onPrevQuestion}
                  className="border-2 border-[#1C293C] bg-white px-4 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  Précédent
                </button>

                {isLastQuizQuestion ? (
                  <button
                    onClick={onSubmitCheckpointQuiz}
                    disabled={!canSubmitQuiz}
                    className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    Terminer
                  </button>
                ) : (
                  <button
                    onClick={onNextQuestion}
                    disabled={!canAdvanceCurrentQuiz}
                    className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    Avancer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Résultats */}
          {questions.length > 0 && quizCompleted && quizScore !== null && (
            <div className="space-y-3">
              <div className={`border-2 border-[#1C293C] p-4 space-y-3 ${quizPassed ? 'bg-[#16A34A]/8' : 'bg-[#DC2626]/5'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">
                      Résultat checkpoint
                    </p>
                    <p className="text-base font-black text-[#1C293C] mt-0.5">
                      {quizPassed ? 'Checkpoint validé ✓' : 'Checkpoint à renforcer'}
                    </p>
                  </div>
                  <span className={`border-2 border-[#1C293C] px-3 py-1 text-sm font-black ${quizPassed ? 'bg-[#FDC800]' : 'bg-white'} text-[#1C293C]`}>
                    {quizScorePercent}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Questions', value: questions.length, color: '' },
                    { label: 'Correctes', value: correctAnswersCount, color: 'text-[#16A34A]' },
                    { label: 'À corriger', value: wrongAnswersCount, color: 'text-[#DC2626]' },
                    { label: 'Minimum', value: minimumToPass, color: '' },
                  ].map((stat) => (
                    <div key={stat.label} className="border border-[#1C293C]/20 bg-white p-2">
                      <p className="text-[10px] font-bold text-[#1C293C]/50">{stat.label}</p>
                      <p className={`text-sm font-black text-[#1C293C] ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const selectedAnswer = userAnswers[i] ?? '';
                  const isCorrect = selectedAnswer === q.answer;

                  return (
                    <div
                      key={`result-${i}`}
                      className={`border-2 border-[#1C293C] p-3 space-y-2 ${isCorrect ? 'border-l-4 border-l-[#16A34A]' : 'border-l-4 border-l-[#DC2626]'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black text-[#432DD7]">
                            Q{i + 1} · {getQuestionTypeLabel(q)}
                          </p>
                          <p className="text-sm font-black text-[#1C293C] mt-0.5 leading-snug">{q.question}</p>
                        </div>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#16A34A] shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#DC2626] shrink-0">
                            <CircleAlert className="h-3 w-3" /> À revoir
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="border border-[#1C293C]/20 bg-[#FBFBF9] p-2">
                          <p className="text-[10px] font-bold text-[#1C293C]/50">Ta réponse</p>
                          <p className="text-xs font-semibold text-[#1C293C]">{selectedAnswer || '—'}</p>
                        </div>
                        <div className="border border-[#16A34A]/40 bg-[#16A34A]/5 p-2">
                          <p className="text-[10px] font-bold text-[#16A34A]/70">Bonne réponse</p>
                          <p className="text-xs font-semibold text-[#1C293C]">{q.answer}</p>
                        </div>
                      </div>

                      <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-2">
                        <p className="text-[10px] font-bold text-[#1C293C]/40 mb-0.5">Explication</p>
                        <p className="text-xs font-medium text-[#1C293C]/60 leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onGenerateCheckpointQuiz}
                  disabled={quizLoading}
                  className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {quizLoading ? 'Génération...' : 'Refaire un checkpoint'}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
