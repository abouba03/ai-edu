'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, FileCode2, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { trackEvent } from '@/lib/event-tracker';

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

type AiProfile = {
  user?: { level?: string };
  profile?: {
    weak?: string[];
    strong?: string[];
    recentTopics?: string[];
  };
  quizStats?: Array<{ slug: string; passRate: number; attempts: number }>;
  challengeStats?: Array<{ slug: string; passRate: number; attempts: number }>;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug;
}

function normalizeLevel(value?: string): 'débutant' | 'intermédiaire' | 'avancé' {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

function inferExercisePlan(profile: AiProfile | null) {
  const weakTopic = profile?.profile?.weak?.[0];
  if (weakTopic) {
    return {
      slug: weakTopic,
      reason: 'weak_topic',
      level: normalizeLevel(profile?.user?.level),
    };
  }

  const challengeWeak = (profile?.challengeStats || [])
    .filter((item) => item.attempts > 0)
    .sort((a, b) => a.passRate - b.passRate)[0];

  if (challengeWeak?.slug) {
    return {
      slug: challengeWeak.slug,
      reason: 'challenge_low_passrate',
      level: normalizeLevel(profile?.user?.level),
    };
  }

  const recent = profile?.profile?.recentTopics?.[0];
  if (recent) {
    return {
      slug: recent,
      reason: 'recent_topic_reinforcement',
      level: normalizeLevel(profile?.user?.level),
    };
  }

  return {
    slug: 'operations-et-variables-python',
    reason: 'fallback_default',
    level: 'débutant' as const,
  };
}

export default function GeneratorExercisePage() {
  const [currentSlug, setCurrentSlug] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeTests, setChallengeTests] = useState<ChallengeTests | null>(null);
  const [learnerCode, setLearnerCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  async function generatePersonalizedExercise() {
    if (loadingGenerate) return;

    setLoadingGenerate(true);
    setError('');
    setFeedback('');

    try {
      const profileRes = await fetch('/api/learner/ai-profile', { cache: 'no-store' });
      const profileData: AiProfile = await profileRes.json();
      const plan = inferExercisePlan(profileData);

      setCurrentSlug(plan.slug);

      await trackEvent({
        action: 'generator_exercise_plan',
        feature: 'generator_exercise_page',
        status: 'start',
        metadata: {
          topicSlug: plan.slug,
          reason: plan.reason,
          level: plan.level,
        },
      });

      const challengeRes = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
        level: plan.level,
        language: 'Python',
        challenge_topic: topicLabel(plan.slug),
        course_description: `Auto-personalized by learner profile. reason=${plan.reason}`,
        pedagogy_context: {
          level: plan.level,
          pedagogicalStyle: 'Задание для выявления текущих пробелов и проверки понимания',
          aiTone: 'Coach clair et exigeant',
          targetAudience: 'Étudiant',
          courseTitle: topicLabel(plan.slug),
        },
      });

      const nextChallenge = String(challengeRes.data?.challenge ?? '').trim();
      const tests = challengeRes.data?.challenge_tests && typeof challengeRes.data.challenge_tests === 'object'
        ? (challengeRes.data.challenge_tests as ChallengeTests)
        : null;

      setChallenge(nextChallenge || 'Задание не получено.');
      setChallengeTests(tests);
      setLearnerCode(`# ${topicLabel(plan.slug)}\n\n`);

      await trackEvent({
        action: 'generator_exercise_plan',
        feature: 'generator_exercise_page',
        status: 'success',
        metadata: {
          topicSlug: plan.slug,
          reason: plan.reason,
          testsCount: tests?.test_cases?.length ?? 0,
        },
      });
    } catch {
      setError('Ошибка генерации персонализированного упражнения. Проверь backend.');
      await trackEvent({
        action: 'generator_exercise_plan',
        feature: 'generator_exercise_page',
        status: 'error',
      });
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function submitSolution() {
    if (!challenge.trim() || !learnerCode.trim() || loadingSubmit) return;

    setLoadingSubmit(true);

    await trackEvent({
      action: 'generator_exercise_submit',
      feature: 'generator_exercise_page',
      status: 'start',
      metadata: { topicSlug: currentSlug },
    });

    try {
      const response = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: challenge,
        student_code: learnerCode,
        challenge_tests: challengeTests,
        pedagogy_context: {
          pedagogicalStyle: 'Correction ciblée sur erreurs logiques',
          aiTone: 'Coach clair et exigeant',
          targetAudience: 'Étudiant',
          courseTitle: topicLabel(currentSlug),
        },
      });

      const evaluationJson = response.data?.evaluation_json;
      const evaluationText = response.data?.evaluation ?? '';
      const serializedFeedback =
        evaluationJson && typeof evaluationJson === 'object'
          ? JSON.stringify(evaluationJson, null, 2)
          : String(evaluationText || '');

      setFeedback(serializedFeedback);

      const noteRaw = String(evaluationJson?.note ?? '');
      const noteMatch = noteRaw.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
      const note = noteMatch ? Number(noteMatch[1].replace(',', '.')) : null;
      const solved = Boolean(evaluationJson?.test_summary?.all_passed) || (note !== null && note >= 7);

      await fetch('/api/course-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'challenge',
          courseSlug: currentSlug || 'operations-et-variables-python',
          courseTitle: topicLabel(currentSlug || 'operations-et-variables-python'),
          challengeText: challenge,
          submittedCode: learnerCode,
          evaluation: evaluationJson ?? { evaluation: evaluationText },
          status: solved ? 'success' : 'submitted',
        }),
      });

      await trackEvent({
        action: 'generator_exercise_submit',
        feature: 'generator_exercise_page',
        status: solved ? 'success' : 'error',
        metadata: { topicSlug: currentSlug, solved },
      });
    } catch {
      setFeedback('Ошибка проверки решения. Попробуй еще раз.');
      await trackEvent({
        action: 'generator_exercise_submit',
        feature: 'generator_exercise_page',
        status: 'error',
        metadata: { topicSlug: currentSlug },
      });
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Feature 02</p>
            <h1 className="text-2xl font-black text-[#1C293C] inline-flex items-center gap-2">
              <FileCode2 className="h-5 w-5" /> Exercices personnalisés
            </h1>
            <p className="mt-1 text-sm font-medium text-[#1C293C]/65">
              Aucun formulaire de thème ou mode: l&apos;exercice est généré automatiquement depuis tes données d&apos;apprentissage.
            </p>
          </div>
          <Link
            href="/generator"
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour hub
          </Link>
        </div>
      </section>

      <section className="border-2 border-[#1C293C] bg-white p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-3">
        <button
          type="button"
          onClick={generatePersonalizedExercise}
          disabled={loadingGenerate}
          className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#432DD7] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-50"
        >
          {loadingGenerate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loadingGenerate ? 'Генерация...' : 'Générer un exercice personnalisé'}
        </button>

        {currentSlug && (
          <p className="text-xs font-semibold text-[#1C293C]/70">
            Sujet choisi automatiquement: <span className="font-black text-[#1C293C]">{topicLabel(currentSlug)}</span>
          </p>
        )}

        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      </section>

      {challenge && (
        <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C] space-y-4">
          <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Exercice
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-[#1C293C]/80 font-medium leading-relaxed">{challenge}</pre>
            {challengeTests?.test_cases?.length ? (
              <p className="mt-3 text-xs font-bold text-[#1C293C]/70 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#432DD7]" />
                {challengeTests.test_cases.length} tests automatiques
              </p>
            ) : null}
          </article>

          <article className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">Ta solution</p>
            <textarea
              value={learnerCode}
              onChange={(event) => setLearnerCode(event.target.value)}
              className="w-full min-h-[280px] border-2 border-[#1C293C] bg-[#FBFBF9] p-3 font-mono text-sm text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C]"
              placeholder="Écris ta solution ici..."
            />
          </article>

          <button
            type="button"
            onClick={submitSolution}
            disabled={loadingSubmit || !learnerCode.trim()}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-4 py-2 text-sm font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] disabled:opacity-50"
          >
            {loadingSubmit ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loadingSubmit ? 'Проверка...' : 'Vérifier ma solution'}
          </button>
        </section>
      )}

      {feedback && (
        <section className="border-2 border-[#1C293C] bg-[#1C293C] shadow-[4px_4px_0px_0px_#432DD7]">
          <div className="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-widest font-black text-white/70">Feedback</div>
          <pre className="overflow-x-auto p-4 text-sm font-mono text-green-300 whitespace-pre-wrap max-h-[340px] overflow-y-auto">{feedback}</pre>
        </section>
      )}
    </div>
  );
}
