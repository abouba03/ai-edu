'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  Lightbulb,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { trackEvent } from '@/lib/event-tracker';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ALL_COURSE_SLUG = '__all_topics__';

const TOPIC_LABELS: Record<string, string> = {
  'operations-et-variables-python': 'Переменные и операции',
  'conditions-et-boucles-python': 'Условия и циклы',
  'listes-strings-slices': 'Списки и строки',
  'tuples-dictionnaires-sets': 'Кортежи, словари и множества',
  'fonctions-fichiers-python': 'Функции и файлы',
  'exceptions-with-modules': 'Исключения и модули',
  'oop-bases-python': 'ООП: классы и объекты',
  'oop-avance-et-decorateurs': 'ООП: наследование и декораторы',
  'python-capstone-et-revision': 'Финальный проект',
};

const ALL_SLUGS = Object.keys(TOPIC_LABELS);

function topicLabel(slug: string): string {
  if (slug === ALL_COURSE_SLUG) return 'Весь курс Python';
  return TOPIC_LABELS[slug] ?? slug;
}

type ExerciseMode = 'weak' | 'strong' | 'explore';

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

type UserProfile = {
  user: { name: string; level: string };
  profile: { strong: string[]; weak: string[]; recentTopics: string[] };
};

function TopicBadge({ slug, variant }: { slug: string; variant: 'strong' | 'weak' }) {
  const style =
    variant === 'strong'
      ? 'bg-[#FDC800] border-[#1C293C] text-[#1C293C]'
      : 'bg-white border-[#1C293C] text-[#1C293C]';
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 ${style} px-3 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#1C293C]`}>
      {variant === 'strong' ? <TrendingUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {topicLabel(slug)}
    </span>
  );
}

export default function AiTutorPanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [mode, setMode] = useState<ExerciseMode>('weak');
  const [selectedSlug, setSelectedSlug] = useState<string>(ALL_COURSE_SLUG);

  const [generatorPrompt, setGeneratorPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeGenError, setCodeGenError] = useState('');

  const [codeChallenge, setCodeChallenge] = useState('');
  const [codeChallengeTests, setCodeChallengeTests] = useState<ChallengeTests | null>(null);
  const [learnerCode, setLearnerCode] = useState('');
  const [challengeFeedback, setChallengeFeedback] = useState('');
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState('');

  const modeConfig: Record<ExerciseMode, { label: string; desc: string; icon: typeof Target }> = {
    weak: { label: 'Укрепить слабое', desc: 'Практика на темах с трудностями', icon: Target },
    strong: { label: 'Развить сильное', desc: 'Более сложная практика по сильным темам', icon: TrendingUp },
    explore: { label: 'Открыть новое', desc: 'Исследовать новые темы', icon: Sparkles },
  };

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const res = await fetch('/api/learner/ai-profile', { cache: 'no-store' });
        const data: UserProfile = await res.json();
        if (!mounted) return;
        setProfile(data);
      } catch {
        // keep quiet: page works even without profile
      } finally {
        if (mounted) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (mode === 'weak' && profile.profile.weak[0]) {
      setSelectedSlug(profile.profile.weak[0]);
      return;
    }
    if (mode === 'strong' && profile.profile.strong[0]) {
      setSelectedSlug(profile.profile.strong[0]);
      return;
    }
    if (mode === 'explore') {
      const used = new Set([...profile.profile.strong, ...profile.profile.weak]);
      const unexplored = ALL_SLUGS.find((slug) => !used.has(slug));
      setSelectedSlug(unexplored ?? ALL_COURSE_SLUG);
    }
  }, [mode, profile]);

  const availableSlugs = useMemo(() => {
    if (!profile) return ALL_SLUGS;
    if (mode === 'weak' && profile.profile.weak.length > 0) return profile.profile.weak;
    if (mode === 'strong' && profile.profile.strong.length > 0) return profile.profile.strong;
    if (mode === 'explore') {
      const used = new Set([...profile.profile.strong, ...profile.profile.weak]);
      const unexplored = ALL_SLUGS.filter((slug) => !used.has(slug));
      return unexplored.length > 0 ? unexplored : ALL_SLUGS;
    }
    return ALL_SLUGS;
  }, [mode, profile]);

  function buildCodeTemplate(tests: ChallengeTests | null): string {
    const fnName = tests?.function_name?.trim();
    if (fnName) {
      return `def ${fnName}(value):\n    # TODO: напиши решение\n    pass\n`;
    }
    return '# TODO: напиши решение\n\n';
  }

  async function handleGenerateCode() {
    const prompt = generatorPrompt.trim();
    if (!prompt || isGeneratingCode) return;

    setIsGeneratingCode(true);
    setCodeGenError('');
    setGeneratedCode('');

    await trackEvent({ action: 'generator_code_start', feature: 'ai_tutor', status: 'start', metadata: { slug: selectedSlug } });

    try {
      const res = await axios.post(`${apiBaseUrl}/generate/`, {
        prompt,
        pedagogy_context: {
          level: profile?.user?.level ?? 'débutant',
          pedagogicalStyle: 'Пошаговый практический код',
          aiTone: 'Coach clair et concret',
          targetAudience: 'Étudiant en programmation',
          courseTitle: topicLabel(selectedSlug),
        },
      });

      const code = String(res.data?.code ?? '').trim();
      setGeneratedCode(code || '# Пустой ответ от модели');

      await trackEvent({ action: 'generator_code_start', feature: 'ai_tutor', status: 'success', metadata: { slug: selectedSlug } });
    } catch {
      setCodeGenError('Ошибка генерации кода. Проверь, что backend запущен.');
      await trackEvent({ action: 'generator_code_start', feature: 'ai_tutor', status: 'error', metadata: { slug: selectedSlug } });
    } finally {
      setIsGeneratingCode(false);
    }
  }

  async function handleGenerateChallenge() {
    if (isGeneratingChallenge) return;

    setIsGeneratingChallenge(true);
    setChallengeError('');
    setChallengeFeedback('');
    setCodeChallenge('');
    setCodeChallengeTests(null);

    await trackEvent({ action: 'generator_exercise_start', feature: 'ai_tutor', status: 'start', metadata: { mode, slug: selectedSlug } });

    try {
      const level =
        profile?.user?.level === 'avancé'
          ? 'avancé'
          : profile?.user?.level === 'intermédiaire'
            ? 'intermédiaire'
            : 'débutant';

      const res = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
        level,
        language: 'Python',
        challenge_topic: topicLabel(selectedSlug),
        course_description: `Mode: ${mode}`,
        pedagogy_context: {
          level,
          pedagogicalStyle:
            mode === 'weak'
              ? 'Упражнение с усилением слабых мест'
              : mode === 'strong'
                ? 'Более продвинутое упражнение для сильной стороны'
                : 'Открытие новой темы через практику',
          aiTone: 'Coach précis et encourageant',
          targetAudience: 'Étudiant',
          courseTitle: topicLabel(selectedSlug),
        },
      });

      const challengeText = String(res.data?.challenge ?? '').trim();
      const tests = res.data?.challenge_tests && typeof res.data.challenge_tests === 'object'
        ? (res.data.challenge_tests as ChallengeTests)
        : null;

      setCodeChallenge(challengeText || 'Задание не получено.');
      setCodeChallengeTests(tests);
      setLearnerCode(buildCodeTemplate(tests));

      await trackEvent({ action: 'generator_exercise_start', feature: 'ai_tutor', status: 'success', metadata: { mode, slug: selectedSlug } });
    } catch {
      setChallengeError('Ошибка генерации упражнения. Проверь, что backend запущен.');
      await trackEvent({ action: 'generator_exercise_start', feature: 'ai_tutor', status: 'error', metadata: { mode, slug: selectedSlug } });
    } finally {
      setIsGeneratingChallenge(false);
    }
  }

  async function handleSubmitChallenge() {
    if (!codeChallenge.trim() || !learnerCode.trim() || isSubmittingChallenge) return;

    setIsSubmittingChallenge(true);

    await trackEvent({ action: 'generator_exercise_submit', feature: 'ai_tutor', status: 'start', metadata: { slug: selectedSlug } });

    try {
      const response = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: codeChallenge,
        student_code: learnerCode,
        challenge_tests: codeChallengeTests,
        pedagogy_context: {
          level: profile?.user?.level ?? 'débutant',
          pedagogicalStyle: 'Correction orientée progression',
          aiTone: 'Coach clair et exigeant',
          targetAudience: 'Étudiant',
          courseTitle: topicLabel(selectedSlug),
        },
      });

      const feedbackObj = response.data?.evaluation_json;
      const feedbackText = response.data?.evaluation;
      setChallengeFeedback(
        feedbackObj && typeof feedbackObj === 'object'
          ? JSON.stringify(feedbackObj, null, 2)
          : String(feedbackText || '')
      );

      await trackEvent({ action: 'generator_exercise_submit', feature: 'ai_tutor', status: 'success', metadata: { slug: selectedSlug } });
    } catch {
      setChallengeFeedback('Ошибка при проверке решения. Попробуй еще раз.');
      await trackEvent({ action: 'generator_exercise_submit', feature: 'ai_tutor', status: 'error', metadata: { slug: selectedSlug } });
    } finally {
      setIsSubmittingChallenge(false);
    }
  }

  return (
    <div className="space-y-6">
      {profileLoading && (
        <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-5 shadow-[4px_4px_0px_0px_#1C293C] inline-flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#432DD7]" />
          <span className="text-sm font-bold text-[#1C293C]/60">Анализ профиля...</span>
        </div>
      )}

      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Section 1</p>
            <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2"><Code2 className="h-4 w-4" /> Générer du code</h2>
          </div>
          <span className="border-2 border-[#1C293C] bg-white px-2.5 py-1 text-[10px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]">
            {topicLabel(selectedSlug)}
          </span>
        </div>

        <textarea
          value={generatorPrompt}
          onChange={(event) => setGeneratorPrompt(event.target.value)}
          className="w-full min-h-24 border-2 border-[#1C293C] bg-white p-3 text-sm font-medium text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] focus:outline-none"
          placeholder="Ex: Écris une fonction Python qui trie une liste de tuples par la 2e colonne avec gestion des cas limites."
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={isGeneratingCode || !generatorPrompt.trim()}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-50"
          >
            {isGeneratingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isGeneratingCode ? 'Генерация...' : 'Сгенерировать код'}
          </button>
        </div>

        {codeGenError && (
          <div className="border-2 border-[#1C293C] bg-red-50 p-3 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-sm font-bold text-red-700">{codeGenError}</p>
          </div>
        )}

        {generatedCode && (
          <div className="border-2 border-[#1C293C] bg-[#1C293C] shadow-[4px_4px_0px_0px_#432DD7]">
            <div className="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-widest font-black text-white/60">Generated Code</div>
            <pre className="overflow-x-auto p-4 text-sm font-mono text-green-300 whitespace-pre-wrap">{generatedCode}</pre>
          </div>
        )}
      </section>

      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Section 2</p>
            <h2 className="text-lg font-black text-[#1C293C] inline-flex items-center gap-2"><FileCode2 className="h-4 w-4" /> Générer un exercice à résoudre</h2>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-[#1C293C] mb-2">Mode pédagogique</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(modeConfig) as ExerciseMode[]).map((item) => {
                const Icon = modeConfig[item].icon;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`border-2 p-2.5 text-left shadow-[2px_2px_0px_0px_#1C293C] ${mode === item ? 'bg-[#1C293C] text-white border-[#1C293C]' : 'bg-white text-[#1C293C] border-[#1C293C]'}`}
                  >
                    <p className="inline-flex items-center gap-1.5 text-xs font-black"><Icon className="h-3.5 w-3.5" /> {modeConfig[item].label}</p>
                    <p className={`text-[11px] mt-1 ${mode === item ? 'text-white/70' : 'text-[#1C293C]/60'}`}>{modeConfig[item].desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-[#1C293C] mb-2">Тема</label>
            <select
              value={selectedSlug}
              onChange={(event) => setSelectedSlug(event.target.value)}
              className="w-full border-2 border-[#1C293C] bg-white px-3 py-2.5 text-sm font-bold text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]"
            >
              <option value={ALL_COURSE_SLUG}>{topicLabel(ALL_COURSE_SLUG)}</option>
              {availableSlugs.map((slug) => (
                <option key={slug} value={slug}>{topicLabel(slug)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateChallenge}
            disabled={isGeneratingChallenge}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-50"
          >
            {isGeneratingChallenge ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {isGeneratingChallenge ? 'Генерация...' : 'Сгенерировать упражнение'}
          </button>

          {codeChallenge && (
            <button
              type="button"
              onClick={handleGenerateChallenge}
              disabled={isGeneratingChallenge}
              className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C]"
            >
              <RefreshCw className="h-4 w-4" /> Nouveau sujet
            </button>
          )}
        </div>

        {challengeError && (
          <div className="border-2 border-[#1C293C] bg-red-50 p-3 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-sm font-bold text-red-700">{challengeError}</p>
          </div>
        )}

        {codeChallenge && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Задание
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-[#1C293C]/80 font-medium leading-relaxed">{codeChallenge}</pre>
              {codeChallengeTests?.test_cases?.length ? (
                <p className="mt-3 text-xs font-bold text-[#1C293C]/70 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#432DD7]" />
                  {codeChallengeTests.test_cases.length} автоматических тестов
                </p>
              ) : null}
            </article>

            <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">Решение студента</p>
              <textarea
                value={learnerCode}
                onChange={(event) => setLearnerCode(event.target.value)}
                className="w-full min-h-[300px] border-2 border-[#1C293C] bg-[#FBFBF9] p-3 font-mono text-sm text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]"
                placeholder="Напиши решение здесь..."
              />
            </article>
          </div>
        )}

        {codeChallenge && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubmitChallenge}
              disabled={isSubmittingChallenge || !learnerCode.trim()}
              className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-50"
            >
              {isSubmittingChallenge ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {isSubmittingChallenge ? 'Проверка...' : 'Проверить решение'}
            </button>
          </div>
        )}

        {challengeFeedback && (
          <div className="border-2 border-[#1C293C] bg-[#1C293C] shadow-[4px_4px_0px_0px_#432DD7]">
            <div className="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-widest font-black text-white/60">Feedback</div>
            <pre className="overflow-x-auto p-4 text-sm font-mono text-green-300 whitespace-pre-wrap max-h-[320px] overflow-y-auto">{challengeFeedback}</pre>
          </div>
        )}
      </section>

      {!profileLoading && profile && (
        <section className="grid gap-3 md:grid-cols-2">
          <article className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Темы с трудностями</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.profile.weak.length > 0 ? profile.profile.weak.map((slug) => (
                <TopicBadge key={slug} slug={slug} variant="weak" />
              )) : <p className="text-sm font-medium text-[#1C293C]/50">Пока нет данных</p>}
            </div>
          </article>

          <article className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Сильные темы</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.profile.strong.length > 0 ? profile.profile.strong.map((slug) => (
                <TopicBadge key={slug} slug={slug} variant="strong" />
              )) : <p className="text-sm font-medium text-[#1C293C]/50">Пока нет данных</p>}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
