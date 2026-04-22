'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import {
  Target,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  Code2,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Zap,
  PlayCircle,
  FileCode2,
  Lightbulb,
  X,
} from 'lucide-react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ALL_COURSE_SLUG = '__all_topics__';

// ── Slug → Russian topic label ──────────────────────────────────────────────
const TOPIC_LABELS: Record<string, string> = {
  'operations-et-variables-python': 'Переменные и Операции',
  'conditions-et-boucles-python': 'Условия и Циклы',
  'listes-strings-slices': 'Списки и Строки',
  'tuples-dictionnaires-sets': 'Кортежи, Словари и Множества',
  'fonctions-fichiers-python': 'Функции и Файлы',
  'exceptions-with-modules': 'Исключения и Модули',
  'oop-bases-python': 'ООП: Классы и Объекты',
  'oop-avance-et-decorateurs': 'ООП: Наследование и Декораторы',
  'python-capstone-et-revision': 'Финальный Проект',
};

const ALL_SLUGS = Object.keys(TOPIC_LABELS);

function topicLabel(slug: string): string {
  if (slug === ALL_COURSE_SLUG) {
    return 'Весь курс Python';
  }
  return TOPIC_LABELS[slug] ?? slug;
}

// ── Types ────────────────────────────────────────────────────────────────────
type UserProfile = {
  user: { name: string; level: string };
  stats: {
    totalQuizPassed: number;
    totalChallengeSuccess: number;
    avgProgress: number;
    successRate: number;
    totalEvents: number;
  };
  quizStats: { slug: string; attempts: number; avgScore: number; passRate: number }[];
  challengeStats: { slug: string; attempts: number; passRate: number }[];
  profile: { strong: string[]; weak: string[]; recentTopics: string[] };
};

type QuizQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

type ExerciseMode = 'weak' | 'strong' | 'explore';
type ExerciseType = 'quiz' | 'code';

type ChallengeTests = {
  mode?: string;
  function_name?: string;
  test_cases?: Array<{
    name?: string;
    args_literal?: string;
    expected_literal?: string;
    constraint?: string;
  }>;
};

function TopicBadge({ slug, variant }: { slug: string; variant: 'strong' | 'weak' | 'neutral' }) {
  const style =
    variant === 'strong'
      ? 'bg-[#FDC800] border-[#1C293C] text-[#1C293C]'
      : variant === 'weak'
      ? 'bg-white border-[#1C293C] text-[#1C293C]'
      : 'bg-[#FBFBF9] border-[#1C293C] text-[#1C293C]';
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 ${style} px-3 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#1C293C]`}>
      {variant === 'strong' && <TrendingUp className="h-3 w-3" />}
      {variant === 'weak' && <AlertTriangle className="h-3 w-3" />}
      {topicLabel(slug)}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AiTutorPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshingProfile, setRefreshingProfile] = useState(false);

  // Exercise state
  const [mode, setMode] = useState<ExerciseMode>('weak');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('quiz');
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);

  // Code state
  const [codeChallenge, setCodeChallenge] = useState('');
  const [codeChallengeTests, setCodeChallengeTests] = useState<ChallengeTests | null>(null);
  const [learnerCode, setLearnerCode] = useState('');
  const [codeFeedback, setCodeFeedback] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  async function loadProfile(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshingProfile(true);
    } else {
      setProfileLoading(true);
    }

    try {
      const res = await fetch('/api/learner/ai-profile', { cache: 'no-store' });
      const data: UserProfile = await res.json();
      setProfile(data);
      if (!selectedSlug) {
        const slug = pickSuggestedSlug(data, mode);
        setSelectedSlug(slug);
      }
    } catch {
      // silently ignore
    } finally {
      if (silent) {
        setRefreshingProfile(false);
      } else {
        setProfileLoading(false);
      }
    }
  }

  // ── Load user profile ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      await loadProfile();
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Update suggested slug when mode changes
  useEffect(() => {
    if (!profile) return;
    setSelectedSlug(pickSuggestedSlug(profile, mode));
    resetExercise();
  }, [mode]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function pickSuggestedSlug(p: UserProfile, m: ExerciseMode): string {
    if (m === 'weak') {
      const s = p.profile.weak[0] ?? p.profile.recentTopics[0] ?? ALL_SLUGS[1];
      return s;
    }
    if (m === 'strong') {
      return p.profile.strong[0] ?? ALL_SLUGS[0];
    }
    // explore: pick a slug not in strong or weak
    const done = new Set([...p.profile.strong, ...p.profile.weak, ...p.profile.recentTopics]);
    const unexplored = ALL_SLUGS.find((s) => !done.has(s));
    return unexplored ?? ALL_SLUGS[Math.floor(Math.random() * ALL_SLUGS.length)];
  }

  function getSuggestionPool(): string[] {
    if (!profile) return ALL_SLUGS;
    if (mode === 'weak') {
      const weak = profile.profile.weak;
      return weak.length > 0 ? weak : ALL_SLUGS;
    }
    if (mode === 'strong') {
      const strong = profile.profile.strong;
      return strong.length > 0 ? strong : ALL_SLUGS;
    }
    // explore
    const done = new Set([...profile.profile.strong, ...profile.profile.weak]);
    const unexplored = ALL_SLUGS.filter((s) => !done.has(s));
    return unexplored.length > 0 ? unexplored : ALL_SLUGS;
  }

  function buildGenerationTheme(slug: string): string {
    if (slug === ALL_COURSE_SLUG) {
      return 'Весь курс Python: переменные, условия, циклы, списки, строки, словари, функции, файлы, исключения, модули и основы ООП';
    }
    return topicLabel(slug);
  }

  function resetExercise() {
    setQuestions([]);
    setUserAnswers([]);
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizModalOpen(false);
    setQuizIndex(0);
    setCodeChallenge('');
    setCodeChallengeTests(null);
    setLearnerCode('');
    setCodeFeedback('');
    setGenError('');
  }

  function buildCorrectorHref(): string {
    const params = new URLSearchParams();
    params.set('code', learnerCode || codeChallenge || '');
    params.set('title', topicLabel(selectedSlug));
    params.set('level', profile?.user?.level ?? 'débutant');
    params.set('formation', 'Formation Python Russe');
    params.set('progress', String(profile?.stats?.avgProgress ?? 0));

    if (codeChallenge.trim()) {
      params.set('challenge', codeChallenge);
    }

    const rules = (codeChallengeTests?.test_cases ?? [])
      .map((item) => item.constraint?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 8);
    if (rules.length > 0) {
      params.set('rules', JSON.stringify(rules));
    }

    const tests = (codeChallengeTests?.test_cases ?? [])
      .map((item, index) => {
        const name = item.name?.trim() || `Test ${index + 1}`;
        const expected = item.expected_literal?.trim() || 'expected value';
        return `${name}: ${expected}`;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (tests.length > 0) {
      params.set('tests', JSON.stringify(tests));
    }

    return `/corrector?${params.toString()}`;
  }

  function buildCodeTemplate(tests: ChallengeTests | null): string {
    const fnName = tests?.function_name?.trim();
    if (fnName) {
      return `def ${fnName}(value):\n    # Напиши решение здесь\n    pass\n`;
    }
    return '# Напиши решение задачи здесь\n\n';
  }

  function buildCorrectorHrefFromPayload(payload: {
    challengeText: string;
    tests: ChallengeTests | null;
    starterCode: string;
  }): string {
    const params = new URLSearchParams();
    params.set('code', payload.starterCode);
    params.set('title', topicLabel(selectedSlug));
    params.set('level', profile?.user?.level ?? 'débutant');
    params.set('formation', 'Formation Python Russe');
    params.set('progress', String(profile?.stats?.avgProgress ?? 0));

    if (payload.challengeText.trim()) {
      params.set('challenge', payload.challengeText);
    }

    const rules = (payload.tests?.test_cases ?? [])
      .map((item) => item.constraint?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 8);
    if (rules.length > 0) {
      params.set('rules', JSON.stringify(rules));
    }

    const testLabels = (payload.tests?.test_cases ?? [])
      .map((item, index) => {
        const name = item.name?.trim() || `Test ${index + 1}`;
        const expected = item.expected_literal?.trim() || 'expected value';
        return `${name}: ${expected}`;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (testLabels.length > 0) {
      params.set('tests', JSON.stringify(testLabels));
    }

    return `/corrector?${params.toString()}`;
  }

  // ── Exercise generation ───────────────────────────────────────────────────
  async function handleGenerate() {
    if (!selectedSlug) return;
    resetExercise();
    setGenerating(true);
    setGenError('');

    const label = buildGenerationTheme(selectedSlug);
    const level = profile?.user?.level === 'avancé' ? 'avancé' : profile?.user?.level === 'intermédiaire' ? 'intermédiaire' : 'débutant';

    await trackEvent({ action: 'ai_tutor_generate', feature: 'ai_tutor', status: 'start', metadata: { mode, exerciseType, slug: selectedSlug } });

    try {
      if (exerciseType === 'quiz') {
        const res = await axios.post(`${apiBaseUrl}/generate-quiz/`, {
          theme: label,
          level,
          nb_questions: 10,
          pedagogy_context: {
            level,
            pedagogicalStyle: 'Quiz diagnostique progressif',
            aiTone: 'Coach évaluateur clair',
          },
        });
        setQuestions(res.data.quiz ?? []);
        setQuizModalOpen(true);
        setQuizIndex(0);
        await trackEvent({ action: 'ai_tutor_generate', feature: 'ai_tutor', status: 'success', metadata: { mode, exerciseType, slug: selectedSlug } });
      } else {
        const res = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
          level,
          language: 'Python',
          challenge_topic: label,
          course_description: `Mode: ${mode}`,
          pedagogy_context: {
            level,
            pedagogicalStyle: selectedSlug === ALL_COURSE_SLUG ? 'Challenge de synthèse couvrant plusieurs notions du cours' : mode === 'weak' ? 'Challenge guidé pour renforcer les lacunes' : mode === 'strong' ? 'Challenge avancé orienté performance' : 'Challenge découverte progressif',
            aiTone: 'Coach précis et encourageant',
          },
        });

        const challengeText = String(res.data.challenge ?? '').trim();
        const tests = res.data.challenge_tests && typeof res.data.challenge_tests === 'object'
          ? (res.data.challenge_tests as ChallengeTests)
          : null;
        const safeStarter = buildCodeTemplate(tests);
        const href = buildCorrectorHrefFromPayload({
          challengeText: challengeText || `Реши упражнение по теме: ${label}`,
          tests,
          starterCode: safeStarter,
        });

        await trackEvent({ action: 'ai_tutor_generate', feature: 'ai_tutor', status: 'success', metadata: { mode, exerciseType, slug: selectedSlug } });
        router.push(href);
        return;
      }
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e !== null && 'response' in e
          ? ((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? null)
          : null;
      setGenError(detail ?? 'Ошибка при генерации упражнения. Проверьте, что бэкенд запущен.');
      await trackEvent({ action: 'ai_tutor_generate', feature: 'ai_tutor', status: 'error', metadata: { mode, exerciseType, slug: selectedSlug } });
    } finally {
      setGenerating(false);
    }
  }

  function handleQuizAnswer(index: number, choice: string) {
    if (quizSubmitted) return;
    const updated = [...userAnswers];
    updated[index] = choice;
    setUserAnswers(updated);
  }

  async function handleQuizSubmit() {
    if (userAnswers.length < questions.length) return;
    const correct = questions.filter((q, i) => userAnswers[i] === q.answer).length;
    setQuizScore(correct);
    setQuizSubmitted(true);
    const passed = correct >= Math.ceil(questions.length / 2);

    await trackEvent({
      action: 'ai_tutor_quiz_submit',
      feature: 'ai_tutor',
      status: passed ? 'success' : 'error',
      metadata: { slug: selectedSlug, score: correct, total: questions.length },
    });

    try {
      await fetch('/api/course-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quiz',
          courseSlug: selectedSlug,
          courseTitle: topicLabel(selectedSlug),
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

    await loadProfile({ silent: true });
  }

  async function handleSubmitCodeChallenge() {
    if (!codeChallenge.trim() || !learnerCode.trim() || !selectedSlug || isSubmittingCode) return;
    setIsSubmittingCode(true);
    await trackEvent({
      action: 'ai_tutor_code_complete',
      feature: 'ai_tutor',
      status: 'start',
      metadata: { slug: selectedSlug, mode },
    });

    try {
      const response = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: codeChallenge,
        student_code: learnerCode,
        challenge_tests: codeChallengeTests,
        pedagogy_context: {
          level: profile?.user?.level ?? 'débutant',
          pedagogicalStyle: 'Correction explicative orientée progression',
          aiTone: 'Coach clair et exigeant',
        },
      });

      const evaluationJson = response.data?.evaluation_json;
      const evaluationText = response.data?.evaluation ?? '';
      setCodeFeedback(
        evaluationJson && typeof evaluationJson === 'object'
          ? JSON.stringify(evaluationJson, null, 2)
          : String(evaluationText || '')
      );

      const noteRaw = String(evaluationJson?.note ?? '');
      const noteMatch = noteRaw.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
      const note = noteMatch ? Number(noteMatch[1].replace(',', '.')) : null;
      const solved = Boolean(evaluationJson?.test_summary?.all_passed) || (note !== null && note >= 7);

      await fetch('/api/course-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'challenge',
          courseSlug: selectedSlug,
          courseTitle: topicLabel(selectedSlug),
          challengeText: codeChallenge,
          submittedCode: learnerCode,
          evaluation: evaluationJson ?? { evaluation: evaluationText },
          status: solved ? 'success' : 'submitted',
        }),
      });

      await trackEvent({
        action: 'ai_tutor_code_complete',
        feature: 'ai_tutor',
        status: solved ? 'success' : 'error',
        metadata: { slug: selectedSlug, mode, solved },
      });

      await loadProfile({ silent: true });
    } catch {
      setCodeFeedback('Ошибка при проверке решения. Проверьте бэкенд и попробуйте снова.');
      await trackEvent({
        action: 'ai_tutor_code_complete',
        feature: 'ai_tutor',
        status: 'error',
        metadata: { slug: selectedSlug, mode },
      });
    } finally {
      setIsSubmittingCode(false);
    }
  }

  // ── Mode labels ───────────────────────────────────────────────────────────
  const modeConfig: Record<ExerciseMode, { label: string; desc: string; icon: typeof Target }> = {
    weak: { label: 'Укрепить слабое', desc: 'Работать над темами с низким результатом', icon: Target },
    strong: { label: 'Развить сильное', desc: 'Углубить знания в сильных темах', icon: TrendingUp },
    explore: { label: 'Открыть новое', desc: 'Исследовать неизученные темы', icon: Sparkles },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {profileLoading && (
        <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-6 shadow-[4px_4px_0px_0px_#1C293C] flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#432DD7]" />
          <span className="text-sm font-bold text-[#1C293C]/60">Анализ профиля...</span>
        </div>
      )}
      {!profileLoading && refreshingProfile && (
        <div className="border-2 border-[#1C293C] bg-[#FDC800] p-3 shadow-[3px_3px_0px_0px_#1C293C] inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#1C293C]" />
          <span className="text-xs font-black text-[#1C293C]">Обновляю профиль ИИ...</span>
        </div>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.55fr)_300px]">
        <section className="overflow-hidden border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[5px_5px_0px_0px_#1C293C]">
          <div className="border-b-2 border-[#1C293C] bg-[linear-gradient(135deg,#FDC800_0%,#FFE793_100%)] px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-[#1C293C]/70 mb-1">Генератор практики</p>
                <h2 className="text-xl font-black leading-tight text-[#1C293C] sm:text-2xl">Собери упражнение под свой текущий уровень</h2>
                <p className="mt-1.5 max-w-xl text-xs font-medium text-[#1C293C]/70 sm:text-sm">
                  Выбери цель практики, тему и формат задания. Квиз откроется в отдельном окне, а кодовое упражнение сразу переведёт тебя в редактор.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="border-2 border-[#1C293C] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
                  {profile?.user?.level ?? 'débutant'}
                </span>
                <span className="border-2 border-[#1C293C] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
                  {exerciseType === 'quiz' ? 'Quiz modal' : 'Code vers editor'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-black text-[#1C293C] mb-2">Тема</label>
                  <div className="relative">
                    <select
                      value={selectedSlug}
                      onChange={(e) => { setSelectedSlug(e.target.value); resetExercise(); }}
                      className="w-full appearance-none border-2 border-[#1C293C] bg-white px-3.5 py-2.5 text-sm font-bold text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] focus:border-[#432DD7] focus:outline-none focus:shadow-[4px_4px_0px_0px_#432DD7]"
                    >
                      <option value={ALL_COURSE_SLUG}>{topicLabel(ALL_COURSE_SLUG)}</option>
                      {getSuggestionPool().map((slug) => (
                        <option key={slug} value={slug}>{topicLabel(slug)}</option>
                      ))}
                      {getSuggestionPool().length < ALL_SLUGS.length && (
                        <optgroup label="── Все темы ──">
                          {ALL_SLUGS.filter((s) => !getSuggestionPool().includes(s)).map((slug) => (
                            <option key={slug} value={slug}>{topicLabel(slug)}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <svg className="h-4 w-4 text-[#1C293C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-black text-[#1C293C] mb-2">Формат</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([['quiz', 'Квиз', BookOpen, '10 вопросов в модальном окне'], ['code', 'Код', Code2, 'Редактор откроется сразу после генерации']] as [ExerciseType, string, typeof BookOpen, string][]).map(([type, label, Icon, description]) => (
                      <button
                        key={type}
                        onClick={() => { setExerciseType(type); resetExercise(); }}
                        className={`border-2 px-3.5 py-3 text-left shadow-[3px_3px_0px_0px_#1C293C] transition-all ${
                          exerciseType === type
                            ? 'border-[#1C293C] bg-[#1C293C] text-white'
                            : 'border-[#1C293C] bg-white text-[#1C293C] hover:bg-[#432DD7]/8'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-black">
                          <Icon className="h-4 w-4" /> {label}
                        </div>
                        <p className={`mt-1.5 text-[11px] leading-relaxed ${exerciseType === type ? 'text-white/70' : 'text-[#1C293C]/60'}`}>{description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Avant de lancer</p>
                  <h3 className="mt-1 text-base font-black text-[#1C293C]">Résumé de ta session</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-2.5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/45">Тема</p>
                    <p className="mt-1 text-sm font-black text-[#1C293C]">{selectedSlug ? topicLabel(selectedSlug) : 'Выбери тему'}</p>
                  </div>
                  <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-2.5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/45">Что произойдёт</p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-[#1C293C]/70 sm:text-sm">
                      {exerciseType === 'quiz'
                        ? 'Система соберёт диагностический квиз и откроет его в отдельном модальном окне.'
                        : 'Система создаст упражнение и сразу переведёт тебя на страницу кода.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t-2 border-dashed border-[#1C293C]/25 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-lg text-xs font-medium text-[#1C293C]/60 sm:text-sm">
                Выбор темы автоматически подстраивается под твой текущий профиль. Слабые темы получают приоритет, но ты можешь переключиться вручную.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedSlug}
                className="inline-flex items-center justify-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-5 py-2.5 text-sm font-black text-[#1C293C] shadow-[4px_4px_0px_0px_#1C293C] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1C293C] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#1C293C] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Генерирую...</>
                ) : (
                  <><Zap className="h-4 w-4" /> Сгенерировать упражнение</>
                )}
              </button>
            </div>

            {genError && (
              <div className="border-2 border-[#1C293C] bg-red-50 p-4 shadow-[3px_3px_0px_0px_#1C293C] flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-red-700">{genError}</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-4">
          {!profileLoading && profile && (
            <>
              <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Точки роста</p>
                    <h3 className="mt-1 text-base font-black text-[#1C293C]">Слабые темы</h3>
                  </div>
                  <span className="border-2 border-[#1C293C] bg-white px-2.5 py-1 text-[10px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
                    {profile.profile.weak.length}
                  </span>
                </div>
                <p className="mb-2.5 text-xs font-medium text-[#1C293C]/60">Темы, которым сейчас нужно больше практики.</p>
                {profile.profile.weak.length === 0 ? (
                  <p className="text-sm text-[#1C293C]/40 font-medium">Пока нет данных. Сделай несколько квизов или задач, чтобы увидеть анализ.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.profile.weak.map((slug) => (
                      <TopicBadge key={slug} slug={slug} variant="weak" />
                    ))}
                  </div>
                )}
              </section>

              <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Ресурсы</p>
                    <h3 className="mt-1 text-base font-black text-[#1C293C]">Сильные темы</h3>
                  </div>
                  <span className="border-2 border-[#1C293C] bg-white px-2.5 py-1 text-[10px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
                    {profile.profile.strong.length}
                  </span>
                </div>
                <p className="mb-2.5 text-xs font-medium text-[#1C293C]/60">То, на что уже можно опираться при новых упражнениях.</p>
                {profile.profile.strong.length === 0 ? (
                  <p className="text-sm text-[#1C293C]/40 font-medium">Сильные темы появятся после нескольких успешных попыток.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.profile.strong.map((slug) => (
                      <TopicBadge key={slug} slug={slug} variant="strong" />
                    ))}
                  </div>
                )}
              </section>

              <section className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Недавняя активность</p>
                <div className="mt-2.5 space-y-2">
                  {profile.profile.recentTopics.length > 0 ? profile.profile.recentTopics.slice(0, 4).map((slug, index) => (
                    <div key={slug} className="flex items-center gap-2.5 border border-[#1C293C]/15 bg-[#FBFBF9] px-3 py-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center border border-[#1C293C] bg-[#FDC800] text-[10px] font-black text-[#1C293C]">
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-[#1C293C] sm:text-sm">{topicLabel(slug)}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-[#1C293C]/40 font-medium">Недавних тем пока нет.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>

      {/* ── Quiz modal ── */}
      {quizModalOpen && questions.length > 0 && exerciseType === 'quiz' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div
            className="absolute inset-0 bg-[#1C293C]/60"
            onClick={() => setQuizModalOpen(false)}
          />
          <section className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-hidden border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[8px_8px_0px_0px_#1C293C] flex flex-col">
            <div className="border-b-2 border-[#1C293C] px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Квиз</p>
                <h3 className="text-lg font-black text-[#1C293C]">{topicLabel(selectedSlug)}</h3>
                <p className="text-[11px] font-semibold text-[#1C293C]/60 mt-0.5">Вопрос {quizIndex + 1} из {questions.length}</p>
              </div>
              <div className="flex items-center gap-2">
                {quizSubmitted && (
                  <div className="border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 shadow-[2px_2px_0px_0px_#1C293C] text-center">
                    <p className="text-[10px] uppercase font-black">Результат</p>
                    <p className="text-base font-black">{quizScore}/{questions.length}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setQuizModalOpen(false)}
                  className="border-2 border-[#1C293C] bg-white p-2 shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4 text-[#1C293C]" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {(() => {
                const q = questions[quizIndex];
                const answered = !!userAnswers[quizIndex];
                const isCorrect = answered && userAnswers[quizIndex] === q.answer;

                return (
                  <div className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                    <p className="text-[10px] uppercase font-black text-[#432DD7] mb-1">Вопрос {quizIndex + 1}</p>
                    <p className="font-black text-[#1C293C] mb-3">{q.question}</p>
                    <div className="space-y-2">
                      {q.choices.map((choice, ci) => {
                        const selected = userAnswers[quizIndex] === choice;
                        const showResult = quizSubmitted && (selected || choice === q.answer);
                        const correct = choice === q.answer;
                        let btn = 'bg-[#FBFBF9] border-[#1C293C] text-[#1C293C]';
                        if (showResult && correct) btn = 'bg-[#FDC800] border-[#1C293C] text-[#1C293C]';
                        else if (showResult && selected && !correct) btn = 'bg-red-100 border-red-500 text-red-700';
                        else if (selected && !quizSubmitted) btn = 'bg-[#432DD7] border-[#432DD7] text-white';
                        return (
                          <button
                            key={ci}
                            onClick={() => handleQuizAnswer(quizIndex, choice)}
                            disabled={quizSubmitted}
                            className={`w-full text-left border-2 px-4 py-2.5 text-sm font-bold transition-all shadow-[2px_2px_0px_0px_#1C293C] ${btn} ${!quizSubmitted ? 'hover:bg-[#432DD7]/10 cursor-pointer' : 'cursor-default'}`}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && q.explanation && (
                      <div className="mt-3 border-l-4 border-[#432DD7] pl-3">
                        <p className="text-xs font-bold text-[#432DD7] mb-0.5">Объяснение</p>
                        <p className="text-xs text-[#1C293C]/70">{q.explanation}</p>
                      </div>
                    )}
                    {quizSubmitted && (
                      <div className="mt-2 flex items-center gap-1.5">
                        {isCorrect
                          ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-xs font-black text-green-700">Верно</span></>
                          : <><XCircle className="h-4 w-4 text-red-600" /><span className="text-xs font-black text-red-700">Неверно</span></>}
                      </div>
                    )}
                  </div>
                );
              })()}

              {quizSubmitted && (
                <>
                  <div className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C] space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Список ошибок</p>
                    {questions.filter((q, i) => userAnswers[i] !== q.answer).length === 0 ? (
                      <p className="text-sm font-bold text-green-700">Ошибок нет. Отличная работа.</p>
                    ) : (
                      <div className="space-y-2">
                        {questions
                          .map((q, i) => ({ q, i }))
                          .filter(({ q, i }) => userAnswers[i] !== q.answer)
                          .map(({ q, i }) => (
                            <div key={`err-${i}`} className="border border-red-300 bg-red-50 p-3">
                              <p className="text-xs font-black text-red-700">Вопрос {i + 1}</p>
                              <p className="text-sm font-semibold text-[#1C293C] mt-1">{q.question}</p>
                              <p className="text-xs text-red-700 mt-1">Твоя ошибка: {userAnswers[i] || 'Нет ответа'}</p>
                              <p className="text-xs text-green-700 mt-0.5">Правильный ответ: {q.answer}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C] space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Вопросы и ответы</p>
                    <div className="space-y-2">
                      {questions.map((q, i) => {
                        const ok = userAnswers[i] === q.answer;
                        return (
                          <div key={`qa-${i}`} className="border border-[#1C293C]/20 bg-[#FBFBF9] p-3">
                            <p className="text-xs font-black text-[#1C293C]">Вопрос {i + 1}</p>
                            <p className="text-sm font-semibold text-[#1C293C] mt-1">{q.question}</p>
                            <p className={`text-xs mt-1 ${ok ? 'text-green-700' : 'text-red-700'}`}>
                              Твой ответ: {userAnswers[i] || 'Нет ответа'}
                            </p>
                            <p className="text-xs text-[#1C293C]/70 mt-0.5">Правильный: {q.answer}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t-2 border-[#1C293C] p-4 flex flex-wrap items-center gap-2 justify-between">
              <p className="text-xs font-semibold text-[#1C293C]/60">
                {quizSubmitted
                  ? 'Проверь объяснения и сгенерируй новый квиз при необходимости.'
                  : `Отвечено: ${userAnswers.filter(Boolean).length}/${questions.length}`}
              </p>
              <div className="flex items-center gap-2">
                {!quizSubmitted && (
                  <>
                    <button
                      type="button"
                      onClick={() => setQuizIndex((v) => Math.max(0, v - 1))}
                      disabled={quizIndex === 0}
                      className="border-2 border-[#1C293C] bg-white px-4 py-2 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Назад
                    </button>

                    {quizIndex < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setQuizIndex((v) => Math.min(questions.length - 1, v + 1))}
                        disabled={!userAnswers[quizIndex]}
                        className="border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Далее
                      </button>
                    ) : (
                      <button
                        onClick={handleQuizSubmit}
                        disabled={userAnswers.filter(Boolean).length < questions.length}
                        className="flex items-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0px_0px_#1C293C] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Проверить ответы
                      </button>
                    )}
                  </>
                )}

                {quizSubmitted && (
                  <button
                    onClick={() => { resetExercise(); handleGenerate(); }}
                    className="flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-5 py-2.5 text-sm font-black text-[#1C293C] shadow-[4px_4px_0px_0px_#1C293C] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1C293C]"
                  >
                    <RefreshCw className="h-4 w-4" /> Новый квиз
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Code exercise display ── */}
      {codeChallenge && exerciseType === 'code' && (
        <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-6 shadow-[6px_6px_0px_0px_#1C293C] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Упражнение с кодом</p>
              <h3 className="text-lg font-black text-[#1C293C]">{topicLabel(selectedSlug)}</h3>
            </div>
            <button
              onClick={() => { resetExercise(); handleGenerate(); }}
              className="flex items-center gap-2 border-2 border-[#1C293C] bg-white px-4 py-2 text-xs font-black shadow-[3px_3px_0px_0px_#1C293C] hover:bg-[#FDC800] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Новое упражнение
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Задание
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-[#1C293C]/80 font-medium leading-relaxed">{codeChallenge}</pre>
              </article>
              {codeChallengeTests?.test_cases?.length ? (
                <article className="border-2 border-[#1C293C] bg-[#FDC800] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
                  <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]">Проверки</p>
                  <p className="text-xs font-bold text-[#1C293C]/80 mt-1">{codeChallengeTests.test_cases.length} тест(ов) будет проверено автоматически.</p>
                </article>
              ) : null}
            </div>

            <div className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5 mb-2">
                <FileCode2 className="h-3.5 w-3.5" /> Твое решение
              </p>
              <textarea
                value={learnerCode}
                onChange={(e) => setLearnerCode(e.target.value)}
                className="w-full min-h-[320px] border-2 border-[#1C293C] bg-[#FBFBF9] p-4 font-mono text-sm text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] focus:outline-none focus:border-[#432DD7] focus:shadow-[4px_4px_0px_0px_#432DD7]"
                placeholder="Напиши код решения здесь..."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSubmitCodeChallenge}
              disabled={isSubmittingCode || !learnerCode.trim()}
              className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0px_0px_#1C293C] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#1C293C] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmittingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {isSubmittingCode ? 'Проверяю решение...' : 'Проверить решение'}
            </button>

            <a
              href={buildCorrectorHref()}
              className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-5 py-2.5 text-sm font-black text-[#1C293C] shadow-[4px_4px_0px_0px_#1C293C] hover:bg-[#FDC800] transition-colors"
            >
              <BarChart3 className="h-4 w-4" /> Открыть в корректоре
            </a>
          </div>

          {codeFeedback ? (
            <div className="border-2 border-[#1C293C] bg-[#1C293C] shadow-[4px_4px_0px_0px_#432DD7]">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Feedback</span>
              </div>
              <pre className="overflow-x-auto p-5 text-sm font-mono text-green-300 leading-relaxed max-h-[360px] overflow-y-auto whitespace-pre-wrap">
                {codeFeedback}
              </pre>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
