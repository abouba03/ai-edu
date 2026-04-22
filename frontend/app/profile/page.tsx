'use client';

import { useEffect, useState } from 'react';
import { UserCircle2, Activity, GraduationCap, Award, Target, Lightbulb } from 'lucide-react';

type LearnerProgression = {
  learner: {
    name: string;
    level: string;
    email: string;
  };
  metrics: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    avgProgress: number;
    unlockedBadges: number;
    totalBadges: number;
  };
  badges: Array<{
    key: string;
    label: string;
    unlocked: boolean;
    reason: string;
  }>;
  objectives: Array<{
    key: string;
    label: string;
    progress: number;
  }>;
  recommendation: {
    title: string;
    reason: string;
    formationName?: string;
  };
  resume: {
    title: string;
    suggestion: string;
    lastProgress?: number;
  };
};

export default function ProfilePage() {
  const [name, setName] = useState('Ученик');
  const [level, setLevel] = useState('начинающий');
  const [progression, setProgression] = useState<LearnerProgression | null>(null);
  const [progressionMessage, setProgressionMessage] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        setName(data?.name ?? 'Ученик');
        setLevel(data?.level ?? 'начинающий');
      })
      .catch(() => undefined);

    fetch('/api/learner/progression')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error('progression_error');
        }
        return data as LearnerProgression;
      })
      .then((data) => {
        setProgression(data);
        setProgressionMessage('');
      })
      .catch(() => {
        setProgressionMessage('Расширенный прогресс временно недоступен.');
      });
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Профиль ученика</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Мой профиль</h1>
        <p className="text-muted-foreground mt-2">Просмотри свой учебный профиль и текущий уровень.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Имя</p>
          <p className="font-semibold">{name}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Уровень</p>
          <p className="font-semibold">{level}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Статус</p>
          <p className="font-semibold">Активен</p>
        </div>
      </section>

      {progression && (
        <>
          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Бейджи ({progression.metrics.unlockedBadges}/{progression.metrics.totalBadges})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {progression.badges.map((badge) => (
                <div key={badge.key} className="rounded-lg border bg-background p-3">
                  <p className="text-sm font-semibold">{badge.label} {badge.unlocked ? '✅' : '🔒'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{badge.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Цели и прогресс
            </h2>
            <div className="space-y-3">
              {progression.objectives.map((objective) => (
                <div key={objective.key} className="rounded-lg border bg-background p-3 space-y-2">
                  <p className="text-sm font-medium">{objective.label}</p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, objective.progress)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.min(100, objective.progress)}%</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" /> Умные рекомендации
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">Следующий урок</p>
                <p className="text-sm mt-1">{progression.recommendation.title}</p>
                {progression.recommendation.formationName && (
                  <p className="text-xs text-muted-foreground mt-1">{progression.recommendation.formationName}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">{progression.recommendation.reason}</p>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">Умное продолжение</p>
                <p className="text-sm mt-1">{progression.resume.title}</p>
                {typeof progression.resume.lastProgress === 'number' && (
                  <p className="text-xs text-muted-foreground mt-1">Предыдущий прогресс: {progression.resume.lastProgress}%</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">{progression.resume.suggestion}</p>
              </div>
            </div>
          </section>
        </>
      )}

      {progressionMessage && (
        <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {progressionMessage}
        </section>
      )}
    </div>
  );
}
