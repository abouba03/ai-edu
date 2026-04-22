"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Brain, Sparkles, Target, Zap, TrendingUp, CheckCircle2, MousePointerClick } from 'lucide-react';

const cards = [
  {
    title: 'Генерация с ИИ',
    description: 'Создание Python-кода из описания задачи.',
    href: '/generator',
    icon: Sparkles,
    bg: 'bg-[#FDC800]',
    iconBg: 'bg-[#1C293C]',
    iconColor: 'text-[#FDC800]',
    text: 'text-[#1C293C]',
    border: 'border-[#1C293C]',
  },
  {
    title: 'Интерактивная отладка',
    description: 'Понимание ошибок шаг за шагом с поддержкой ИИ.',
    href: '/debugger',
    icon: Brain,
    bg: 'bg-[#432DD7]',
    iconBg: 'bg-white',
    iconColor: 'text-[#432DD7]',
    text: 'text-white',
    border: 'border-[#1C293C]',
  },
  {
    title: 'Активная оценка',
    description: 'Измерение прогресса с помощью умных тестов.',
    href: '/challenges',
    icon: Target,
    bg: 'bg-white',
    iconBg: 'bg-[#FDC800]',
    iconColor: 'text-[#1C293C]',
    text: 'text-[#1C293C]',
    border: 'border-[#1C293C]',
  },
];

type MiniChallengeKpis = {
  ok: boolean;
  summary?: {
    sampleSize: number;
    started: number;
    completed: number;
    abandoned: number;
    submissions: number;
    resolveClicks: number;
    completionRate: number | null;
    abandonRate: number | null;
    resolveUsageRate: number | null;
  };
  topTabs?: Array<{ tab: string; opens: number; avgDurationSec: number }>;
  exerciseАнализs?: Array<{
    exerciseId: string;
    views: number;
    completes: number;
    conversionRate: number;
    bestTests: string;
    bestAttemptCount: number | null;
  }>;
};

type LearnerProgression = {
  metrics?: { avgProgress?: number };
  recommendation?: { reason?: string };
};

const STATS = (summary: MiniChallengeKpis['summary'], avgProgress: number | undefined, loading: boolean) => [
  {
    label: 'Запущено заданий',
    value: loading ? '···' : String(summary?.started ?? 0),
    icon: Zap,
    accent: 'bg-[#432DD7]',
    textColor: 'text-white',
    labelColor: 'text-white/70',
  },
  {
    label: 'Процент завершения',
    value: loading ? '···' : `${summary?.completionRate ?? 0}%`,
    icon: CheckCircle2,
    accent: 'bg-[#FDC800]',
    textColor: 'text-[#1C293C]',
    labelColor: 'text-[#1C293C]/70',
  },
  {
    label: 'Использование «Решить»',
    value: loading ? '···' : `${summary?.resolveUsageRate ?? 0}%`,
    icon: MousePointerClick,
    accent: 'bg-white',
    textColor: 'text-[#1C293C]',
    labelColor: 'text-[#1C293C]/60',
  },
  {
    label: 'Прогресс по курсам',
    value: loading ? '···' : `${avgProgress ?? 0}%`,
    icon: TrendingUp,
    accent: 'bg-white',
    textColor: 'text-[#1C293C]',
    labelColor: 'text-[#1C293C]/60',
  },
];

export default function DashboardPage() {
  const [kpis, setKpis] = useState<MiniChallengeKpis | null>(null);
  const [progression, setProgression] = useState<LearnerProgression | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [kpiRes, progRes] = await Promise.all([
          fetch('/api/events/mini-challenge-kpis', { cache: 'no-store' }),
          fetch('/api/learner/progression', { cache: 'no-store' }),
        ]);
        const [kpiData, progData] = await Promise.all([kpiRes.json(), progRes.json()]);
        if (!isMounted) return;
        setKpis(kpiData);
        setProgression(progData);
      } catch {
        if (!isMounted) return;
        setKpis({ ok: false });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, []);

  const topRecommendation = useMemo(
    () =>
      progression?.recommendation?.reason ??
      'Continue avec un mini-challenge pour consolider tes acquis du cours.',
    [progression],
  );

  const summary = kpis?.summary;
  const topExercise = kpis?.exerciseАнализs?.[0];
  const stats = STATS(summary, progression?.metrics?.avgProgress, loading);

  return (
    <div className="space-y-6">

      {/* ── HERO ── */}
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-6 lg:p-8 shadow-[6px_6px_0px_0px_#1C293C]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-widest font-black text-[#432DD7]">
              Учебный дашборд
            </p>
            <h1 className="text-3xl lg:text-4xl font-black text-[#1C293C] mt-1 leading-tight">
              Общий обзор<br className="hidden sm:block" /> платформы
            </h1>
            <p className="text-[#1C293C]/60 mt-3 text-sm font-medium leading-relaxed">
              Твой центральный раздел для управления генерацией, исправлением и отслеживанием прогресса.
            </p>
          </div>
          <Link
            href="/dashboard/insights"
            className="self-start lg:self-auto inline-flex items-center gap-2 border-2 border-[#1C293C] bg-[#FDC800] px-5 py-3 text-sm font-black text-[#1C293C] shadow-[5px_5px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[5px] hover:translate-y-[5px] transition-all duration-100 whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4" />
            ИИ-аналитика обучения
          </Link>
        </div>
      </section>

      {/* ── KPI STATS ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className={`border-2 border-[#1C293C] ${stat.accent} p-4 shadow-[4px_4px_0px_0px_#1C293C]`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-[10px] uppercase tracking-widest font-bold ${stat.labelColor}`}>
                  {stat.label}
                </p>
                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${stat.textColor} opacity-60`} />
              </div>
              <p className={`text-3xl font-black mt-2 ${stat.textColor} leading-none`}>
                {stat.value}
              </p>
            </article>
          );
        })}
      </section>

      {/* ── INSIGHTS ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Анализ principal */}
        <article className="border-2 border-[#1C293C] bg-white shadow-[4px_4px_0px_0px_#1C293C] p-5 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Анализ</p>
            <h2 className="text-lg font-black text-[#1C293C] mt-0.5">Рекомендация ИИ</h2>
          </div>
          <p className="text-sm font-medium text-[#1C293C]/70 leading-relaxed">
            {topRecommendation}
          </p>
          {topExercise ? (
            <div className="border-2 border-[#1C293C] bg-[#FDC800] p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/70 mb-1">
                Самое частое упражнение
              </p>
              <p className="text-sm font-black text-[#1C293C]">{topExercise.exerciseId}</p>
              <div className="flex gap-4 mt-1.5 text-[11px] font-semibold text-[#1C293C]/70">
                <span>Conversion {topExercise.conversionRate}%</span>
                <span>Лучший: {topExercise.bestTests}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-[#1C293C]/40">Последние упражнения не найдены.</p>
          )}
        </article>

        {/* Самые используемые вкладки */}
        <article className="border-2 border-[#1C293C] bg-white shadow-[4px_4px_0px_0px_#1C293C] p-5 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Аналитика</p>
            <h2 className="text-lg font-black text-[#1C293C] mt-0.5">Самые используемые вкладки</h2>
          </div>
          {(kpis?.topTabs?.length ?? 0) === 0 ? (
            <p className="text-sm font-medium text-[#1C293C]/40">
              Недостаточно данных для отображения навигационных привычек.
            </p>
          ) : (
            <ul className="space-y-2">
              {kpis?.topTabs?.slice(0, 4).map((item, i) => (
                <li
                  key={item.tab}
                  className="border-2 border-[#1C293C] px-3 py-2.5 flex items-center justify-between gap-3 text-sm"
                  style={{ background: i === 0 ? '#FDC800' : 'white' }}
                >
                  <span className="font-black text-[#1C293C] truncate">{item.tab}</span>
                  <span className="text-[11px] font-semibold text-[#1C293C]/60 shrink-0">
                    {item.opens} откр. · {item.avgDurationSec}с
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* ── QUICK ACCESS ── */}
      <section>
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-3">
          Быстрый доступ
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border-2 ${item.border} ${item.bg} p-5 space-y-4 shadow-[5px_5px_0px_0px_#1C293C] hover:shadow-[2px_2px_0px_0px_#1C293C] hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100 group`}
              >
                <div className={`size-10 border-2 border-[#1C293C] ${item.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <div>
                  <h2 className={`font-black text-base ${item.text}`}>{item.title}</h2>
                  <p className={`text-xs font-medium mt-1 leading-relaxed ${item.text} opacity-70`}>
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── TIP ── */}
      <section className="border-2 border-[#1C293C] bg-white p-4 flex items-start gap-4 shadow-[3px_3px_0px_0px_#1C293C]">
        <div className="size-9 border-2 border-[#1C293C] bg-[#432DD7] flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-medium text-[#1C293C]/70 leading-relaxed">
          <span className="font-black text-[#1C293C]">Совет: </span>
          твои обучающие сигналы доступны через аналитические эндпоинты для непрерывного улучшения промптов, заданий и обратной связи.
        </p>
      </section>

    </div>
  );
}
