'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import LearningActionCard from '@/components/courses/_components/learning-action-card';
import { Bot, Brain, CheckCircle2, CircleAlert, Film, Flag, ListChecks, PenSquare, Rocket, Sparkles, Target } from 'lucide-react';

type Question = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

type Props = {
  courseSlug: string;
  courseTitle: string;
  courseDescription: string;
  courseLevel: string;
  formationName: string;
  courseNumber: number;
  totalCourses: number;
  progressPercent: number;
  nextCourseSlug: string | null;
  nextCourseTitle: string | null;
  videoResources: Array<{ sourceUrl: string; embedUrl: string }>;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function levelToQuiz(level: string): 'débutant' | 'intermédiaire' | 'avancé' {
  const normalized = level.toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

export default function PersonalizedCoursePanel({
  courseSlug,
  courseTitle,
  courseDescription,
  courseLevel,
  formationName,
  courseNumber,
  totalCourses,
  progressPercent,
  nextCourseSlug,
  nextCourseTitle,
  videoResources,
}: Props) {
  const { userId } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);

  const [whatUnderstood, setWhatUnderstood] = useState('');
  const [whatUnclear, setWhatUnclear] = useState('');
  const [reflectionMessage, setReflectionMessage] = useState('');
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  const objectives = useMemo(
    () => [
      `Comprendre le concept clé du cours « ${courseTitle} » et l’expliquer avec ses propres mots.`,
      'Réaliser 2 exercices pratiques sans erreur de syntaxe bloquante.',
      'Valider au moins 2/3 au checkpoint IA pour confirmer la compréhension immédiate.',
    ],
    [courseTitle]
  );

  const helperPrompt = encodeURIComponent(
    `Explique le cours "${courseTitle}" simplement pour un étudiant ${courseLevel}. Contexte: ${courseDescription}`
  );
  const examplePrompt = encodeURIComponent(
    `Donne un exemple concret en Python lié au cours "${courseTitle}" avec explication pas à pas.`
  );
  const testTheme = encodeURIComponent(courseTitle);

  async function logVideoStarted(sourceUrl: string) {
    await trackEvent({
      action: 'video_started',
      feature: 'course_learning',
      status: 'start',
      metadata: { courseSlug, courseTitle, formationName, sourceUrl },
    });
  }

  async function generateCheckpointQuiz() {
    setQuizLoading(true);
    setQuizCompleted(false);
    setQuizScore(null);
    setCurrentQuizIndex(0);

    await trackEvent({
      action: 'checkpoint_quiz_generate',
      feature: 'course_learning',
      status: 'start',
      metadata: { courseSlug, courseTitle },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/generate-quiz/`, {
        theme: courseTitle,
        level: levelToQuiz(courseLevel),
        nb_questions: 10,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          progressPercent,
          aiTone: 'Coach motivant et précis',
          pedagogicalStyle: 'Micro-évaluation active en slide horizontal, questions Vrai/Faux et QCM',
          targetAudience: formationName,
          passThreshold: 70,
          weeklyGoalHours: 5,
        },
      });

      const generatedQuestions = res.data.quiz ?? [];
      setQuestions(generatedQuestions);
      setUserAnswers(Array.from({ length: generatedQuestions.length }, () => ''));

      await trackEvent({
        action: 'checkpoint_quiz_generate',
        feature: 'course_learning',
        status: 'success',
        metadata: { courseSlug, count: (res.data.quiz ?? []).length },
      });
    } catch {
      setQuestions([]);
      await trackEvent({
        action: 'checkpoint_quiz_generate',
        feature: 'course_learning',
        status: 'error',
        metadata: { courseSlug },
      });
    } finally {
      setQuizLoading(false);
    }
  }

  async function submitCheckpointQuiz() {
    if (questions.length === 0) return;

    let correct = 0;
    questions.forEach((q, index) => {
      if (userAnswers[index] === q.answer) {
        correct += 1;
      }
    });

    setQuizScore(correct);
    setQuizCompleted(true);
    setCurrentQuizIndex(0);

    const passed = correct >= Math.ceil(questions.length * 0.66);
    await trackEvent({
      action: passed ? 'quiz_passed' : 'quiz_failed',
      feature: 'course_learning',
      status: passed ? 'success' : 'error',
      metadata: { courseSlug, score: correct, total: questions.length },
    });

    try {
      await fetch('/api/course-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quiz',
          actorClerkId: userId ?? undefined,
          courseSlug,
          courseTitle,
          score: correct,
          totalQuestions: questions.length,
          passed,
          answers: userAnswers,
          questions,
        }),
      });
    } catch {
      // keep silent: persistence must not block UX
    }
  }

  async function saveReflection() {
    setIsSavingReflection(true);
    try {
      await trackEvent({
        action: 'reflection_saved',
        feature: 'course_learning',
        status: 'success',
        metadata: {
          courseSlug,
          understood: whatUnderstood,
          unclear: whatUnclear,
        },
      });

      setReflectionMessage('Réflexion enregistrée. Les prochaines explications seront adaptées à ton retour.');

      try {
        await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reflection',
            actorClerkId: userId ?? undefined,
            courseSlug,
            courseTitle,
            understood: whatUnderstood,
            unclear: whatUnclear,
          }),
        });
      } catch {
        // keep silent: persistence must not block UX
      }
    } catch {
      setReflectionMessage('Impossible d’enregistrer pour le moment. Réessaie dans quelques secondes.');
    } finally {
      setIsSavingReflection(false);
    }
  }

  async function askForHelp() {
    await trackEvent({
      action: 'need_help',
      feature: 'course_learning',
      status: 'start',
      metadata: { courseSlug, courseTitle },
    });
  }

  const answeredQuestions = userAnswers.filter((answer) => answer.trim().length > 0).length;
  const canSubmitQuiz = questions.length > 0 && questions.every((_, index) => Boolean(userAnswers[index]));
  const minimumToPass = questions.length > 0 ? Math.ceil(questions.length * 0.66) : 0;
  const quizPassed = quizScore !== null && quizScore >= minimumToPass;
  const quizScorePercent = quizScore !== null && questions.length > 0
    ? Math.round((quizScore / questions.length) * 100)
    : 0;
  const correctAnswersCount = quizScore ?? 0;
  const wrongAnswersCount = questions.length > 0 ? Math.max(questions.length - correctAnswersCount, 0) : 0;
  const currentQuizQuestion = questions[currentQuizIndex] ?? null;
  const isLastQuizQuestion = currentQuizIndex >= Math.max(questions.length - 1, 0);
  const canAdvanceCurrentQuiz =
    quizCompleted || Boolean(userAnswers[currentQuizIndex] && userAnswers[currentQuizIndex].trim());

  function getQuestionTypeLabel(question: Question): 'Vrai/Faux' | 'QCM' {
    if (question.choices.length === 2) {
      const normalized = question.choices.map((choice) => choice.trim().toLowerCase());
      const trueFalseSet = new Set(['vrai', 'faux', 'true', 'false']);
      if (normalized.every((choice) => trueFalseSet.has(choice))) {
        return 'Vrai/Faux';
      }
    }
    return 'QCM';
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card p-6 lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="absolute -top-20 -right-12 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-14 size-72 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          <div className="lg:col-span-2 space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
              <Sparkles className="h-4 w-4" /> Learning Command Center
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold leading-tight">Ta progression personnalisée en temps réel</h2>
            <p className="text-sm text-muted-foreground">
              Cette page adapte l’accompagnement selon tes actions, ton rythme et tes résultats sur le cours.
            </p>
          </div>

          <div className="rounded-2xl border bg-background/80 p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Formation active</p>
            <p className="font-semibold leading-tight">{formationName}</p>
            <p className="text-xs text-muted-foreground">Cours {courseNumber}/{totalCourses} • Niveau {courseLevel}</p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs font-medium text-primary">{progressPercent}% complété</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border bg-card p-5 space-y-4">
        <h3 className="font-semibold text-lg">Actions pédagogiques rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LearningActionCard
            icon={<Target className="h-4 w-4" />}
            title="Checkpoint IA (8–12 questions)"
            description="Mode slide horizontal: 1 question à la fois (Vrai/Faux + QCM)."
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">Lancer le checkpoint</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Checkpoint IA (slide horizontal)</DialogTitle>
                    <DialogDescription>
                      Réponds question par question puis clique sur Avancer jusqu’au score final.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="rounded-xl border bg-background p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Progression du checkpoint</p>
                        <p className="text-xs text-muted-foreground">
                          {questions.length === 0
                            ? 'Génère 8 à 12 questions pour commencer.'
                            : `${answeredQuestions}/${questions.length} réponse(s) complétée(s)`}
                        </p>
                      </div>
                      <Button onClick={generateCheckpointQuiz} disabled={quizLoading}>
                        {quizLoading ? 'Génération...' : questions.length > 0 ? 'Régénérer les 10 questions' : 'Générer 10 questions'}
                      </Button>
                    </div>

                    {questions.length > 0 && (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.round((answeredQuestions / questions.length) * 100)}%` }}
                        />
                      </div>
                    )}

                    {questions.length > 0 && currentQuizQuestion && !quizCompleted && (
                      <div className="space-y-4">
                        <div className="rounded-xl border bg-background p-3 overflow-hidden">
                          <div
                            className="flex transition-transform duration-300 ease-out"
                            style={{ transform: `translateX(-${currentQuizIndex * 100}%)` }}
                          >
                            {questions.map((q, i) => {
                              const selectedAnswer = userAnswers[i] ?? '';
                              const hasAnswered = selectedAnswer.length > 0;
                              const isCorrect = quizCompleted && selectedAnswer === q.answer;
                              const isWrong = quizCompleted && hasAnswered && selectedAnswer !== q.answer;

                              return (
                                <div key={`${q.question}-${i}`} className="w-full shrink-0 px-1">
                                  <div
                                    className={`rounded-xl border p-4 space-y-3 ${
                                      isCorrect
                                        ? 'border-primary/40 bg-primary/5'
                                        : isWrong
                                          ? 'border-destructive/40 bg-destructive/5'
                                          : 'bg-background'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Question {i + 1}/{questions.length}</p>
                                        <p className="font-medium text-sm leading-snug">{q.question}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                          {getQuestionTypeLabel(q)}
                                        </span>
                                        {quizCompleted && (
                                          isCorrect ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                              <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                              <CircleAlert className="h-3.5 w-3.5" /> À revoir
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                      {q.choices.map((choice) => {
                                        const isSelected = selectedAnswer === choice;
                                        return (
                                          <label
                                            key={`${q.question}-${choice}`}
                                            className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                                              isSelected
                                                ? 'border-primary/50 bg-primary/5'
                                                : 'border-border hover:bg-accent'
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              className="mt-0.5"
                                              name={`checkpoint-${i}`}
                                              value={choice}
                                              checked={isSelected}
                                              disabled={quizCompleted}
                                              onChange={() => {
                                                if (quizCompleted) return;
                                                const next = [...userAnswers];
                                                next[i] = choice;
                                                setUserAnswers(next);
                                              }}
                                            />
                                            <span className="text-sm leading-snug">{choice}</span>
                                          </label>
                                        );
                                      })}
                                    </div>

                                    {quizCompleted && (
                                      <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                                        <p className="text-xs">
                                          <span className="font-medium">Bonne réponse:</span> {q.answer}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{q.explanation}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            disabled={currentQuizIndex === 0}
                            onClick={() => setCurrentQuizIndex((value) => Math.max(0, value - 1))}
                          >
                            Précédent
                          </Button>

                          {isLastQuizQuestion ? (
                            <Button onClick={submitCheckpointQuiz} disabled={!canSubmitQuiz}>
                              Terminer le checkpoint
                            </Button>
                          ) : (
                            <Button
                              onClick={() => setCurrentQuizIndex((value) => Math.min(questions.length - 1, value + 1))}
                              disabled={!canAdvanceCurrentQuiz}
                            >
                              Avancer
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {questions.length > 0 && quizCompleted && quizScore !== null && (
                      <div className="space-y-4">
                        <div
                          className={`rounded-2xl border p-5 space-y-4 ${
                            quizPassed
                              ? 'border-primary/30 bg-primary/10'
                              : 'border-destructive/30 bg-destructive/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Résultat checkpoint</p>
                              <p className="text-lg font-bold mt-1">{quizPassed ? 'Checkpoint validé 🎯' : 'Checkpoint à renforcer'}</p>
                            </div>
                            <span className="inline-flex items-center rounded-full border border-primary/30 bg-background/80 px-3 py-1 text-xs font-semibold">
                              Score final: {quizScorePercent}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-xl border bg-background/80 p-3">
                              <p className="text-[11px] text-muted-foreground">Total questions</p>
                              <p className="text-lg font-semibold">{questions.length}</p>
                            </div>
                            <div className="rounded-xl border bg-background/80 p-3">
                              <p className="text-[11px] text-muted-foreground">Bonnes réponses</p>
                              <p className="text-lg font-semibold text-primary">{correctAnswersCount}</p>
                            </div>
                            <div className="rounded-xl border bg-background/80 p-3">
                              <p className="text-[11px] text-muted-foreground">À corriger</p>
                              <p className="text-lg font-semibold text-destructive">{wrongAnswersCount}</p>
                            </div>
                            <div className="rounded-xl border bg-background/80 p-3">
                              <p className="text-[11px] text-muted-foreground">Minimum requis</p>
                              <p className="text-lg font-semibold">{minimumToPass}</p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {quizPassed
                              ? 'Excellent, tu peux continuer avec un niveau de difficulté progressif.'
                              : 'Regarde les corrections ci-dessous puis relance un nouveau checkpoint si nécessaire.'}
                          </p>
                        </div>

                        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                          {questions.map((q, i) => {
                            const selectedAnswer = userAnswers[i] ?? '';
                            const isCorrect = selectedAnswer === q.answer;

                            return (
                              <div
                                key={`checkpoint-result-${q.question}-${i}`}
                                className={`rounded-xl border p-4 space-y-3 ${
                                  isCorrect
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-destructive/30 bg-destructive/5'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-[11px] text-muted-foreground">Question {i + 1}/{questions.length} • {getQuestionTypeLabel(q)}</p>
                                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                                  </div>
                                  {isCorrect ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                      <CircleAlert className="h-3.5 w-3.5" /> À revoir
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="rounded-lg border bg-background/80 p-2">
                                    <p className="text-[11px] text-muted-foreground mb-1">Ta réponse</p>
                                    <p className="text-xs font-medium">{selectedAnswer || '—'}</p>
                                  </div>
                                  <div className="rounded-lg border bg-background/80 p-2">
                                    <p className="text-[11px] text-muted-foreground mb-1">Bonne réponse</p>
                                    <p className="text-xs font-medium">{q.answer}</p>
                                  </div>
                                </div>

                                <div className="rounded-lg border bg-background/70 p-2.5">
                                  <p className="text-[11px] text-muted-foreground mb-1">Explication</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={generateCheckpointQuiz} disabled={quizLoading}>
                            {quizLoading ? 'Génération...' : 'Refaire un autre checkpoint'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            }
          />

          <LearningActionCard
            icon={<Brain className="h-4 w-4" />}
            title="Mini challenge de la leçon"
            description="Ouvre l’atelier dédié (style coding challenge) pour résoudre et soumettre ton code."
            action={
              <Link
                href={`/courses/${courseSlug}/mini-challenge?title=${encodeURIComponent(courseTitle)}&level=${encodeURIComponent(courseLevel)}&formation=${encodeURIComponent(formationName)}&progress=${progressPercent}`}
                className="w-full"
              >
                <Button variant="secondary" className="w-full">Ouvrir l’atelier challenge</Button>
              </Link>
            }
          />

          <LearningActionCard
            icon={<PenSquare className="h-4 w-4" />}
            title="Réflexion active"
            description="Décris ce que tu as compris et ce qui reste flou pour adapter l’accompagnement IA."
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">Ouvrir la réflexion</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Réflexion active</DialogTitle>
                    <DialogDescription>
                      Indique ce que tu as compris et ce qui bloque encore. L’IA adapte ensuite les prochaines explications.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                      <p className="text-sm font-medium">Comment ça marche</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>1) Tu écris ce qui est clair pour toi.</li>
                        <li>2) Tu notes ce qui reste flou ou bloquant.</li>
                        <li>3) L’IA adapte ensuite le niveau d’aide et les prochaines recommandations.</li>
                      </ul>
                    </div>

                    <label className="block text-sm space-y-1">
                      <span className="font-medium">Ce que j’ai compris</span>
                      <textarea
                        className="w-full min-h-28 rounded-lg border bg-background p-3"
                        placeholder="Ex: Je sais utiliser une boucle for, parcourir une liste et faire une condition simple."
                        value={whatUnderstood}
                        onChange={(event) => {
                          setWhatUnderstood(event.target.value);
                          if (reflectionMessage) setReflectionMessage('');
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Sois concret: notions, exemples, ou étapes que tu maîtrises déjà.</p>
                    </label>

                    <label className="block text-sm space-y-1">
                      <span className="font-medium">Ce qui reste flou</span>
                      <textarea
                        className="w-full min-h-28 rounded-lg border bg-background p-3"
                        placeholder="Ex: Je bloque pour transformer l’énoncé en étapes, et je ne sais pas gérer les cas limites."
                        value={whatUnclear}
                        onChange={(event) => {
                          setWhatUnclear(event.target.value);
                          if (reflectionMessage) setReflectionMessage('');
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Décris le blocage principal: compréhension, logique, syntaxe, ou méthode.</p>
                    </label>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {whatUnderstood.trim().length + whatUnclear.trim().length > 0
                          ? 'Prêt à enregistrer ta réflexion.'
                          : 'Ajoute au moins un retour pour activer la personnalisation.'}
                      </p>
                      <Button onClick={saveReflection} disabled={isSavingReflection || (!whatUnderstood.trim() && !whatUnclear.trim())}>
                        {isSavingReflection ? 'Enregistrement...' : 'Enregistrer et personnaliser la suite'}
                      </Button>
                    </div>

                    {reflectionMessage && (
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-sm text-muted-foreground">{reflectionMessage}</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
        <section className="2xl:col-span-8 rounded-[2rem] border bg-card p-5 lg:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold inline-flex items-center gap-2 text-lg">
              <Film className="h-5 w-5 text-primary" /> Studio Vidéo
            </h3>
            {nextCourseSlug && (
              <Link
                href={`/courses/${nextCourseSlug}`}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Rocket className="h-4 w-4" /> Suivant: {nextCourseTitle}
              </Link>
            )}
          </div>

          {videoResources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vidéo disponible pour ce cours.</p>
          ) : (
            <div className="space-y-4">
              {videoResources.map((resource, index) => (
                <article key={resource.embedUrl} className="rounded-2xl border bg-background p-3 lg:p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Séquence {index + 1}</p>
                  <div className="rounded-xl overflow-hidden border bg-background">
                    <iframe
                      className="w-full aspect-video"
                      src={resource.embedUrl}
                      title={`Vidéo ${index + 1} - ${courseTitle}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={resource.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      Ouvrir sur YouTube
                    </a>
                    <Button variant="secondary" onClick={() => logVideoStarted(resource.sourceUrl)}>
                      J’ai lancé cette vidéo
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="2xl:col-span-4 space-y-6">
          <section className="rounded-[2rem] border bg-card p-5 space-y-3">
            <h3 className="font-semibold inline-flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" /> Objectifs mesurables
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {objectives.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-[2rem] border bg-card p-5 space-y-3">
            <h3 className="font-semibold inline-flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Assistant IA contextuel
            </h3>
            <div className="space-y-2">
              <Link href={`/generator?prompt=${helperPrompt}`} className="w-full inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                Explique simplement
              </Link>
              <Link href={`/generator?prompt=${examplePrompt}`} className="w-full inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Donne un exemple
              </Link>
              <Link href={`/challenges?theme=${testTheme}&level=${encodeURIComponent(levelToQuiz(courseLevel))}`} className="w-full inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Teste-moi
              </Link>
              <Button variant="outline" className="w-full" onClick={askForHelp}>J’ai besoin d’aide</Button>
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-[2rem] border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <ListChecks className="h-4 w-4 text-primary" />
        Les données pédagogiques collectées ici influencent les prochaines explications, recommandations et niveaux d’aide.
      </section>
    </div>
  );
}
