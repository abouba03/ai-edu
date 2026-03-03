'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import CourseHero from '@/components/courses/_components/course-hero';
import CheckpointDialog from '@/components/courses/_components/checkpoint-dialog';
import VideoStudioSection from '@/components/courses/_components/video-studio-section';
import CourseSidebar from '@/components/courses/_components/course-sidebar';
import { AdaptiveLevel, Question } from '@/components/courses/_components/personalized-types';
import { Brain, ListChecks, Target } from 'lucide-react';

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
  const [adaptiveLevel, setAdaptiveLevel] = useState<AdaptiveLevel>(levelToQuiz(courseLevel));
  const [serverOrchestration, setServerOrchestration] = useState<{
    adaptiveLevel: 'débutant' | 'intermédiaire' | 'avancé';
    strictCourseValidated: boolean;
    nextSequence: Array<{ step: string; reason: string; cta: string; href: string }>;
  } | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [checkpointAttempts, setCheckpointAttempts] = useState(0);
  const [checkpointStartedAt, setCheckpointStartedAt] = useState<number | null>(null);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [isLoadingMotivation, setIsLoadingMotivation] = useState(false);
  const [videoBlocksCompleted, setVideoBlocksCompleted] = useState<number[]>([]);
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [challengeRetries, setChallengeRetries] = useState(0);

  const objectives = useMemo(
    () => [
      'Comprendre le concept clé du cours et l’expliquer avec ses propres mots.',
      'Réaliser 2 exercices pratiques sans erreur de syntaxe bloquante.',
      'Valider au moins 2/3 au checkpoint IA pour confirmer la compréhension immédiate.',
    ],
    []
  );

  const helperPrompt = encodeURIComponent(
    `Explique le cours "${courseTitle}" simplement pour un étudiant ${courseLevel}. Contexte: ${courseDescription}`
  );
  const challengeCompletedKey = `course:${courseSlug}:challengeCompleted`;
  const challengeAttemptsKey = `course:${courseSlug}:challengeAttempts`;
  const videoBlocksKey = `course:${courseSlug}:videoBlocksCompleted`;

  useEffect(() => {
    const storedChallengeCompleted = window.localStorage.getItem(challengeCompletedKey) === 'true';
    const storedChallengeAttempts = Number(window.localStorage.getItem(challengeAttemptsKey) || '0');
    const storedVideoBlocks = window.localStorage.getItem(videoBlocksKey);
    let parsedVideoBlocks: number[] = [];
    if (storedVideoBlocks) {
      try {
        const parsed = JSON.parse(storedVideoBlocks);
        if (Array.isArray(parsed)) {
          parsedVideoBlocks = parsed.filter((value): value is number => Number.isInteger(value) && value >= 0);
        }
      } catch {
        parsedVideoBlocks = [];
      }
    }

    setChallengeCompleted(storedChallengeCompleted);
    setChallengeRetries(Number.isFinite(storedChallengeAttempts) ? storedChallengeAttempts : 0);
    setVideoBlocksCompleted(parsedVideoBlocks);
    setAdaptiveLevel(levelToQuiz(courseLevel));
  }, [challengeAttemptsKey, challengeCompletedKey, courseLevel, videoBlocksKey]);

  function markVideoBlockCompleted(index: number) {
    setVideoBlocksCompleted((current) => {
      if (current.includes(index)) return current;
      const next = [...current, index].sort((a, b) => a - b);
      window.localStorage.setItem(videoBlocksKey, JSON.stringify(next));
      return next;
    });
  }

  async function refreshOrchestrationPlan() {
    try {
      const res = await fetch(
        `/api/course-orchestration?courseSlug=${encodeURIComponent(courseSlug)}&level=${encodeURIComponent(adaptiveLevel)}`,
        { method: 'GET' }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        adaptiveLevel?: AdaptiveLevel;
        strictCourseValidated?: boolean;
        nextSequence?: Array<{ step: string; reason: string; cta: string; href: string }>;
      };

      if (!data.ok) return;

      if (data.adaptiveLevel) {
        setAdaptiveLevel(data.adaptiveLevel);
      }

      setServerOrchestration({
        adaptiveLevel: data.adaptiveLevel ?? adaptiveLevel,
        strictCourseValidated: Boolean(data.strictCourseValidated),
        nextSequence: Array.isArray(data.nextSequence) ? data.nextSequence : [],
      });
    } catch {
      // keep silent: orchestration stays local
    }
  }

  async function loadMotivation(
    passed: boolean,
    score: number,
    total: number,
    durationSec: number,
    attempts: number
  ) {
    setIsLoadingMotivation(true);
    const mood = !passed || attempts >= 3 ? 'frustré' : passed && durationSec <= 900 ? 'heureux' : 'neutre';
    const recentResult = `Checkpoint ${score}/${total}, durée ${Math.max(1, Math.round(durationSec / 60))} min, tentative ${attempts}`;

    try {
      const res = await axios.post(`${apiBaseUrl}/motivational-feedback/`, {
        username: userId ?? 'Étudiant',
        recent_result: recentResult,
        mood,
      });
      setMotivationalMessage(res.data?.message || 'Continue, chaque itération améliore ta maîtrise.');
    } catch {
      setMotivationalMessage(
        passed
          ? 'Excellent rythme. Passe maintenant au mini challenge pour valider durablement.'
          : 'Tu progresses: corrige une erreur ciblée puis relance un nouveau checkpoint.'
      );
    } finally {
      setIsLoadingMotivation(false);
    }
  }

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
    setQuizDialogOpen(true);
    setCheckpointStartedAt(Date.now());
    setMotivationalMessage('');
    setCheckpointAttempts((value) => value + 1);

    await trackEvent({
      action: 'checkpoint_quiz_generate',
      feature: 'course_learning',
      status: 'start',
      metadata: { courseSlug, courseTitle, adaptiveLevel },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/generate-quiz/`, {
        theme: courseTitle,
        level: adaptiveLevel,
        nb_questions: 10,
        pedagogy_context: {
          level: adaptiveLevel,
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
    const durationSec = checkpointStartedAt ? Math.max(1, Math.round((Date.now() - checkpointStartedAt) / 1000)) : 0;
    setLastCheckpointDurationSec(durationSec);

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

    await loadMotivation(passed, correct, questions.length, durationSec, Math.max(1, checkpointAttempts));
    await refreshOrchestrationPlan();
  }

  async function askForHelp() {
    await trackEvent({
      action: 'need_help',
      feature: 'course_learning',
      status: 'start',
      metadata: { courseSlug, courseTitle },
    });
  }

  useEffect(() => {
    refreshOrchestrationPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSlug]);

  const answeredQuestions = userAnswers.filter((answer) => answer.trim().length > 0).length;
  const canSubmitQuiz = questions.length > 0 && questions.every((_, index) => Boolean(userAnswers[index]));
  const minimumToPass = questions.length > 0 ? Math.ceil(questions.length * 0.66) : 0;
  const quizPassed = quizScore !== null && quizScore >= minimumToPass;
  const strictCourseValidated = quizPassed && challengeCompleted;
  const strictValidatedFromServer = serverOrchestration?.strictCourseValidated ?? strictCourseValidated;
  const quizScorePercent = quizScore !== null && questions.length > 0
    ? Math.round((quizScore / questions.length) * 100)
    : 0;
  const checkpointDurationMin = lastCheckpointDurationSec ? Math.max(1, Math.round(lastCheckpointDurationSec / 60)) : null;
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
    <div className="mx-auto w-full max-w-[1240px] space-y-3 lg:space-y-4 pb-4">
      <CourseHero
        formationName={formationName}
        courseNumber={courseNumber}
        totalCourses={totalCourses}
        courseLevel={courseLevel}
        progressPercent={progressPercent}
      />

      <section className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Niveau</span>
            <span className="rounded-md border bg-background px-2 py-1 text-foreground">{adaptiveLevel}</span>
            <span className={`rounded-md border px-2 py-1 ${strictValidatedFromServer ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              {strictValidatedFromServer ? 'Validé' : 'En cours'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="rounded-md border bg-background px-2 py-1">Quiz {quizCompleted ? `${quizScorePercent}%` : '—'}</span>
            <span className="rounded-md border bg-background px-2 py-1">Retries {challengeRetries}</span>
            <span className="rounded-md border bg-background px-2 py-1">{checkpointDurationMin ? `${checkpointDurationMin} min` : '—'}</span>
          </div>
        </div>
        {(motivationalMessage || isLoadingMotivation) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {isLoadingMotivation ? 'Génération du message motivant...' : motivationalMessage}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <aside className="order-1 xl:order-2 xl:col-span-4 space-y-3 xl:sticky xl:top-3">
          <section className="rounded-xl border bg-card p-3 space-y-2">
            <div>
              <h3 className="font-semibold text-sm">Actions pédagogiques rapides</h3>
              <p className="text-[11px] text-muted-foreground">3 actions clés, format cartes compactes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="rounded-lg border bg-background p-2.5 space-y-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold inline-flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" /> Checkpoint IA</p>
                  <p className="text-[11px] text-muted-foreground">Quiz rapide 8-12 questions.</p>
                </div>
                <CheckpointDialog
                  open={quizDialogOpen}
                  onOpenChange={setQuizDialogOpen}
                  triggerLabel="Lancer"
                  triggerClassName="h-7 w-full px-2.5 text-[11px]"
                  questions={questions}
                  currentQuizQuestion={currentQuizQuestion}
                  quizCompleted={quizCompleted}
                  currentQuizIndex={currentQuizIndex}
                  userAnswers={userAnswers}
                  answeredQuestions={answeredQuestions}
                  quizLoading={quizLoading}
                  canSubmitQuiz={canSubmitQuiz}
                  isLastQuizQuestion={isLastQuizQuestion}
                  canAdvanceCurrentQuiz={canAdvanceCurrentQuiz}
                  quizScore={quizScore}
                  quizPassed={quizPassed}
                  quizScorePercent={quizScorePercent}
                  correctAnswersCount={correctAnswersCount}
                  wrongAnswersCount={wrongAnswersCount}
                  minimumToPass={minimumToPass}
                  onGenerateCheckpointQuiz={generateCheckpointQuiz}
                  onSubmitCheckpointQuiz={submitCheckpointQuiz}
                  onPrevQuestion={() => setCurrentQuizIndex((value) => Math.max(0, value - 1))}
                  onNextQuestion={() => setCurrentQuizIndex((value) => Math.min(questions.length - 1, value + 1))}
                  onSelectAnswer={(questionIndex, choice) => {
                    if (quizCompleted) return;
                    const next = [...userAnswers];
                    next[questionIndex] = choice;
                    setUserAnswers(next);
                  }}
                  getQuestionTypeLabel={getQuestionTypeLabel}
                />
              </div>

              <div className="rounded-lg border bg-background p-2.5 space-y-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold inline-flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-primary" /> Mini challenge</p>
                  <p className="text-[11px] text-muted-foreground">Pratique immédiate sur la leçon.</p>
                </div>
                <Link
                  href={`/courses/${courseSlug}/mini-challenge?title=${encodeURIComponent(courseTitle)}&level=${encodeURIComponent(adaptiveLevel)}&formation=${encodeURIComponent(formationName)}&progress=${progressPercent}`}
                >
                  <Button variant="secondary" className="h-7 w-full px-2.5 text-[11px]">Ouvrir</Button>
                </Link>
              </div>

              <div className="rounded-lg border bg-background p-2.5 space-y-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold inline-flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-primary" /> Assistant IA</p>
                  <p className="text-[11px] text-muted-foreground">Aide contextuelle instantanée.</p>
                </div>
                <Link href={`/generator?prompt=${helperPrompt}`} onClick={askForHelp}>
                  <Button className="h-7 w-full px-2.5 text-[11px]">Ouvrir</Button>
                </Link>
              </div>
            </div>
          </section>

          <CourseSidebar
            objectives={objectives}
          />
        </aside>

        <div className="order-2 xl:order-1 xl:col-span-8">
          <VideoStudioSection
            videoResources={videoResources}
            courseTitle={courseTitle}
            nextCourseSlug={nextCourseSlug}
            nextCourseTitle={nextCourseTitle}
            videoBlocksCompleted={videoBlocksCompleted}
            onVideoStarted={logVideoStarted}
            onMarkVideoBlockCompleted={markVideoBlockCompleted}
            onOpenCheckpoint={() => setQuizDialogOpen(true)}
          />
        </div>
      </div>

      <section className="rounded-xl border bg-card p-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        Les signaux d’apprentissage adaptent automatiquement les prochaines activités.
      </section>
    </div>
  );
}
