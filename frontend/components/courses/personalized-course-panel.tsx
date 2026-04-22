'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { useAuth } from '@clerk/nextjs';
import CheckpointDialog from '@/components/courses/_components/checkpoint-dialog';import VideoStudioSection from '@/components/courses/_components/video-studio-section';
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
      'Понять ключевую тему урока и объяснить ее своими словами.',
      'Сделать 2 практических упражнения без критических синтаксических ошибок.',
      'Пройти минимум 2/3 в ИИ-квизе, чтобы подтвердить понимание темы.',
    ],
    []
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
    const mood = !passed || attempts >= 3 ? 'разочарован' : passed && durationSec <= 900 ? 'доволен' : 'нейтрально';
    const recentResult = `Квиз ${score}/${total}, длительность ${Math.max(1, Math.round(durationSec / 60))} мин, попытка ${attempts}`;

    try {
      const res = await axios.post(`${apiBaseUrl}/motivational-feedback/`, {
        username: userId ?? 'Étudiant',
        recent_result: recentResult,
        mood,
      });
      setMotivationalMessage(res.data?.message || 'Продолжай: каждая попытка улучшает твой навык.');
    } catch {
      setMotivationalMessage(
        passed
          ? 'Отличный темп. Теперь переходи к мини-заданию для закрепления.'
          : 'Ты продвигаешься: исправь одну конкретную ошибку и запусти новый квиз.'
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
          aiTone: 'Поддерживающий и точный наставник',
          pedagogicalStyle: 'Короткая активная проверка по одному вопросу: Верно/Неверно и тесты с вариантами',
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

  function getQuestionTypeLabel(question: Question): 'Верно/Неверно' | 'Тест' {
    if (question.choices.length === 2) {
      const normalized = question.choices.map((choice) => choice.trim().toLowerCase());
      const trueFalseSet = new Set(['vrai', 'faux', 'true', 'false']);
      if (normalized.every((choice) => trueFalseSet.has(choice))) {
        return 'Верно/Неверно';
      }
    }
    return 'Тест';
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-3 lg:space-y-4 pb-4">

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <aside className="order-1 xl:order-2 xl:col-span-4 space-y-3 xl:sticky xl:top-3">

          {/* ── ACTIONS ── */}
          <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Учебные действия</p>
              <h3 className="font-black text-sm text-[#1C293C] mt-0.5">3 ключевых действия</h3>
            </div>

            <div className="space-y-2">
              {/* Quiz IA */}
              <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
                <div>
                  <p className="text-xs font-black text-[#1C293C] inline-flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#432DD7]" /> Квиз ИИ
                  </p>
                  <p className="text-[11px] font-medium text-[#1C293C]/55 mt-0.5">Адаптивный квиз: 8-12 вопросов.</p>
                </div>
                <CheckpointDialog
                  open={quizDialogOpen}
                  onOpenChange={setQuizDialogOpen}
                  triggerLabel="Запустить квиз"
                  triggerClassName="h-8 w-full text-[11px] font-black border-2 border-[#1C293C] bg-[#FDC800] text-[#1C293C] rounded-none shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
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

              {/* Mini challenge */}
              <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
                <div>
                  <p className="text-xs font-black text-[#1C293C] inline-flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-[#432DD7]" /> Мини-задание
                  </p>
                  <p className="text-[11px] font-medium text-[#1C293C]/55 mt-0.5">Сразу практикуйся по текущему уроку.</p>
                </div>
                <Link
                  href={`/courses/${courseSlug}/mini-challenge?title=${encodeURIComponent(courseTitle)}&level=${encodeURIComponent(adaptiveLevel)}&formation=${encodeURIComponent(formationName)}&progress=${progressPercent}`}
                  className="inline-flex w-full items-center justify-center border-2 border-[#1C293C] bg-white px-3 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                >
                  Открыть
                </Link>
              </div>

              {/* Assistant IA */}
              <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
                <div>
                  <p className="text-xs font-black text-[#1C293C] inline-flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-[#432DD7]" /> ИИ-помощник
                  </p>
                  <p className="text-[11px] font-medium text-[#1C293C]/55 mt-0.5">Быстрая помощь по контексту урока.</p>
                </div>
                <Link
                  href={`/tuteur?slug=${encodeURIComponent(courseSlug)}&title=${encodeURIComponent(courseTitle)}&level=${encodeURIComponent(adaptiveLevel)}&description=${encodeURIComponent(courseDescription)}&formation=${encodeURIComponent(formationName)}&progress=${progressPercent}`}
                  onClick={askForHelp}
                  className="inline-flex w-full items-center justify-center border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                >
                  Открыть
                </Link>
              </div>
            </div>
          </section>

          <CourseSidebar objectives={objectives} />
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

      {/* ── TIP ── */}
      <section className="border-2 border-[#1C293C] bg-white p-3 flex items-center gap-2.5 shadow-[2px_2px_0px_0px_#1C293C]">
        <ListChecks className="h-4 w-4 text-[#432DD7] shrink-0" />
        <p className="text-[11px] font-medium text-[#1C293C]/60">
          Сигналы обучения автоматически подстраивают следующие активности.
        </p>
      </section>
    </div>
  );
}
