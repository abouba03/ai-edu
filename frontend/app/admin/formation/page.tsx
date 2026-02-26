'use client';

import { useEffect, useMemo, useState } from 'react';
import { Settings2, Sparkles, Plus, Save, Trash2, RefreshCw, Download, BarChart3 } from 'lucide-react';

type TrainingSettings = {
  programName: string;
  targetAudience: string;
  pedagogicalStyle: string;
  aiTone: string;
  releaseMode: 'cohort' | 'self-paced' | 'hybrid';
  passThreshold: number;
  weeklyGoalHours: number;
  certificationEnabled: boolean;
  challengeAutoPublish: boolean;
  reminderCadenceDays: number;
};

type AdminCourse = {
  id: string;
  title: string;
  description: string | null;
  level: string;
  duration: string | null;
  modules: number;
  topics: unknown;
  updatedAt: string;
};

type CourseForm = {
  title: string;
  description: string;
  formationName: string;
  courseIndex: number;
  level: string;
  duration: string;
  modules: number;
  topicsCsv: string;
};

type AdminAnalytics = {
  summary: {
    totalStudents: number;
    totalEvents: number;
    totalErrors: number;
    totalSuccess: number;
  };
  byStudent: Array<{
    clerkId: string;
    name: string;
    email: string;
    started: number;
    succeeded: number;
    failed: number;
    completionRate: number | null;
  }>;
  frequentErrors: Array<{
    feature: string;
    action: string;
    count: number;
  }>;
  progression: {
    formation: Array<{
      formationName: string;
      learners: number;
      averageProgress: number;
    }>;
    course: Array<{
      courseId: string;
      courseTitle: string;
      formationName: string;
      learners: number;
      averageProgress: number;
    }>;
  };
};

const defaultSettings: TrainingSettings = {
  programName: 'AI Edu Platform - Parcours Python',
  targetAudience: 'Débutants et intermédiaires',
  pedagogicalStyle: 'Apprentissage actif: micro-leçons + pratique + feedback IA',
  aiTone: 'Coach motivant et précis',
  releaseMode: 'hybrid',
  passThreshold: 70,
  weeklyGoalHours: 5,
  certificationEnabled: true,
  challengeAutoPublish: true,
  reminderCadenceDays: 3,
};

const emptyCourseForm: CourseForm = {
  title: '',
  description: '',
  formationName: 'Formation Python',
  courseIndex: 1,
  level: 'Débutant',
  duration: '',
  modules: 0,
  topicsCsv: '',
};

function parseCourseMeta(topics: unknown) {
  if (!topics || typeof topics !== 'object' || Array.isArray(topics)) {
    return { formationName: 'Formation générale', courseIndex: 1 };
  }

  const raw = topics as { formationName?: unknown; courseIndex?: unknown };

  const formationName =
    typeof raw.formationName === 'string' && raw.formationName.trim().length > 0
      ? raw.formationName.trim()
      : 'Formation générale';

  const courseIndex = Math.max(1, Math.min(999, Number(raw.courseIndex ?? 1)));

  return { formationName, courseIndex };
}

function topicsToCsv(topics: unknown) {
  if (Array.isArray(topics)) {
    return topics.filter((item) => typeof item === 'string').join(', ');
  }

  if (topics && typeof topics === 'object') {
    const raw = topics as { youtubeLinks?: unknown };
    if (Array.isArray(raw.youtubeLinks)) {
      return raw.youtubeLinks.filter((item) => typeof item === 'string').join(', ');
    }
  }

  return '';
}

function csvToTopics(csv: string) {
  return csv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminFormationPage() {
  const [settings, setSettings] = useState<TrainingSettings>(defaultSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string>('');

  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesMessage, setCoursesMessage] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(emptyCourseForm);
  const [courseSaving, setCourseSaving] = useState(false);

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsMessage, setAnalyticsMessage] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  async function loadSettings() {
    try {
      const response = await fetch('/api/admin/training-settings', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setSettingsMessage('Accès admin refusé ou service indisponible.');
        return;
      }

      setSettings(data.settings as TrainingSettings);
      setSettingsMessage('');
    } catch {
      setSettingsMessage('Impossible de charger les paramètres globaux.');
    }
  }

  async function loadCourses() {
    setCoursesLoading(true);
    try {
      const response = await fetch('/api/admin/courses', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setCoursesMessage('Accès admin refusé ou base de données indisponible.');
        setCourses([]);
        return;
      }

      const nextCourses = (data.courses ?? []) as AdminCourse[];
      setCourses(nextCourses);
      setCoursesMessage('');

      if (selectedCourseId) {
        const stillExists = nextCourses.some((course) => course.id === selectedCourseId);
        if (!stillExists) {
          setSelectedCourseId(null);
          setCourseForm(emptyCourseForm);
        }
      }
    } catch {
      setCoursesMessage('Impossible de charger les cours.');
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsMessage('');

    try {
      const response = await fetch('/api/admin/analytics', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setAnalyticsMessage('Impossible de charger les analytics admin.');
        setAnalytics(null);
        return;
      }

      setAnalytics(data as AdminAnalytics);
    } catch {
      setAnalyticsMessage('Erreur réseau pendant le chargement analytics.');
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadCourses();
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (!selectedCourse) {
      return;
    }

    setCourseForm({
      ...emptyCourseForm,
      title: selectedCourse.title,
      description: selectedCourse.description ?? '',
      formationName: parseCourseMeta(selectedCourse.topics).formationName,
      courseIndex: parseCourseMeta(selectedCourse.topics).courseIndex,
      level: selectedCourse.level,
      duration: selectedCourse.duration ?? '',
      modules: selectedCourse.modules,
      topicsCsv: topicsToCsv(selectedCourse.topics),
    });
  }, [selectedCourse]);

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMessage('');

    try {
      const response = await fetch('/api/admin/training-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setSettingsMessage('Échec de sauvegarde des paramètres globaux.');
        return;
      }

      setSettings(data.settings as TrainingSettings);
      setSettingsMessage('Paramètres globaux enregistrés.');
    } catch {
      setSettingsMessage('Erreur réseau pendant la sauvegarde.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function createCourse() {
    setCourseSaving(true);
    setCoursesMessage('');

    try {
      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description,
          formationName: courseForm.formationName,
          courseIndex: courseForm.courseIndex,
          level: courseForm.level,
          duration: courseForm.duration,
          modules: courseForm.modules,
          topics: csvToTopics(courseForm.topicsCsv),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setCoursesMessage('Impossible de créer le cours. Vérifie le titre et le niveau.');
        return;
      }

      setCoursesMessage('Cours créé avec succès.');
      setSelectedCourseId(data.course.id as string);
      await loadCourses();
    } catch {
      setCoursesMessage('Erreur réseau pendant la création du cours.');
    } finally {
      setCourseSaving(false);
    }
  }

  async function updateCourse() {
    if (!selectedCourseId) {
      setCoursesMessage('Sélectionne un cours à mettre à jour.');
      return;
    }

    setCourseSaving(true);
    setCoursesMessage('');

    try {
      const response = await fetch(`/api/admin/courses/${selectedCourseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description,
          formationName: courseForm.formationName,
          courseIndex: courseForm.courseIndex,
          level: courseForm.level,
          duration: courseForm.duration,
          modules: courseForm.modules,
          topics: csvToTopics(courseForm.topicsCsv),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setCoursesMessage('Impossible de mettre à jour le cours sélectionné.');
        return;
      }

      setCoursesMessage('Cours mis à jour.');
      await loadCourses();
    } catch {
      setCoursesMessage('Erreur réseau pendant la mise à jour.');
    } finally {
      setCourseSaving(false);
    }
  }

  async function deleteCourse() {
    if (!selectedCourseId) {
      setCoursesMessage('Sélectionne un cours à supprimer.');
      return;
    }

    setCourseSaving(true);
    setCoursesMessage('');

    try {
      const response = await fetch(`/api/admin/courses/${selectedCourseId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setCoursesMessage('Suppression impossible.');
        return;
      }

      setCoursesMessage('Cours supprimé.');
      setSelectedCourseId(null);
      setCourseForm(emptyCourseForm);
      await loadCourses();
    } catch {
      setCoursesMessage('Erreur réseau pendant la suppression.');
    } finally {
      setCourseSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Admin créatif
        </p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Espace Admin Formation</h1>
        <p className="text-muted-foreground mt-2">
          Pilote toute la logique pédagogique: stratégie globale, cadence de progression et catalogue des cours.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Cours administrables</p>
          <p className="text-2xl font-bold mt-1">{courses.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Objectif hebdo</p>
          <p className="text-2xl font-bold mt-1">{settings.weeklyGoalHours}h</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Seuil de validation</p>
          <p className="text-2xl font-bold mt-1">{settings.passThreshold}%</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mode de diffusion</p>
          <p className="text-lg font-bold mt-2">{settings.releaseMode}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard Admin (KPI)
          </h2>
          <div className="flex items-center gap-2">
            <a
              href="/api/admin/analytics?export=csv"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <button
              type="button"
              onClick={loadAnalytics}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" /> Recharger KPI
            </button>
          </div>
        </div>

        {analyticsLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des analytics...</p>
        ) : !analytics ? (
          <p className="text-sm text-muted-foreground">{analyticsMessage || 'Aucune donnée analytics.'}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Étudiants</p>
                <p className="text-xl font-bold">{analytics.summary.totalStudents}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Événements</p>
                <p className="text-xl font-bold">{analytics.summary.totalEvents}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Succès</p>
                <p className="text-xl font-bold">{analytics.summary.totalSuccess}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">Erreurs</p>
                <p className="text-xl font-bold">{analytics.summary.totalErrors}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-background p-3 space-y-2 max-h-80 overflow-auto">
                <p className="text-sm font-semibold">KPI par étudiant</p>
                {analytics.byStudent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune donnée étudiante.</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.byStudent.slice(0, 12).map((item) => (
                      <div key={item.clerkId} className="rounded-lg border p-2 text-xs">
                        <p className="font-semibold">{item.name} <span className="text-muted-foreground">({item.email})</span></p>
                        <p className="text-muted-foreground">
                          started: {item.started} • success: {item.succeeded} • error: {item.failed} • completion: {item.completionRate ?? '-'}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-background p-3 space-y-2 max-h-80 overflow-auto">
                <p className="text-sm font-semibold">Erreurs fréquentes</p>
                {analytics.frequentErrors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune erreur fréquente détectée.</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.frequentErrors.slice(0, 12).map((item, index) => (
                      <div key={`${item.feature}-${item.action}-${index}`} className="rounded-lg border p-2 text-xs">
                        <p className="font-semibold">{item.feature} / {item.action}</p>
                        <p className="text-muted-foreground">Occurrences: {item.count}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-background p-3 space-y-2 max-h-72 overflow-auto">
                <p className="text-sm font-semibold">Progression par formation</p>
                {analytics.progression.formation.map((item) => (
                  <div key={item.formationName} className="rounded-lg border p-2 text-xs">
                    <p className="font-semibold">{item.formationName}</p>
                    <p className="text-muted-foreground">Learners: {item.learners} • Avg progress: {item.averageProgress}%</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-background p-3 space-y-2 max-h-72 overflow-auto">
                <p className="text-sm font-semibold">Progression par cours</p>
                {analytics.progression.course.slice(0, 15).map((item) => (
                  <div key={item.courseId} className="rounded-lg border p-2 text-xs">
                    <p className="font-semibold">{item.courseTitle}</p>
                    <p className="text-muted-foreground">{item.formationName} • Learners: {item.learners} • Avg: {item.averageProgress}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {analyticsMessage && <p className="text-sm text-muted-foreground">{analyticsMessage}</p>}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Paramètres globaux de formation
          </h2>
          <button
            type="button"
            onClick={saveSettings}
            disabled={settingsSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-70"
          >
            <Save className="h-4 w-4" /> {settingsSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm">
            <span>Nom du programme</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.programName}
              onChange={(event) => setSettings((prev) => ({ ...prev, programName: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Audience cible</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.targetAudience}
              onChange={(event) => setSettings((prev) => ({ ...prev, targetAudience: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Style pédagogique</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.pedagogicalStyle}
              onChange={(event) => setSettings((prev) => ({ ...prev, pedagogicalStyle: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Ton de l’IA</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.aiTone}
              onChange={(event) => setSettings((prev) => ({ ...prev, aiTone: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Mode de diffusion</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.releaseMode}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  releaseMode: event.target.value as TrainingSettings['releaseMode'],
                }))
              }
            >
              <option value="cohort">cohort</option>
              <option value="self-paced">self-paced</option>
              <option value="hybrid">hybrid</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Seuil de validation (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.passThreshold}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  passThreshold: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Objectif hebdomadaire (heures)</span>
            <input
              type="number"
              min={1}
              max={40}
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.weeklyGoalHours}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  weeklyGoalHours: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Cadence de rappel (jours)</span>
            <input
              type="number"
              min={1}
              max={30}
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={settings.reminderCadenceDays}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  reminderCadenceDays: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.certificationEnabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  certificationEnabled: event.target.checked,
                }))
              }
            />
            Certification activée
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.challengeAutoPublish}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  challengeAutoPublish: event.target.checked,
                }))
              }
            />
            Publication auto des défis
          </label>
        </div>

        {settingsMessage && <p className="text-sm text-muted-foreground">{settingsMessage}</p>}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">Catalogue de cours (Admin)</h2>
          <button
            type="button"
            onClick={loadCourses}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Recharger
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background p-4 max-h-[420px] overflow-auto">
            {coursesLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des cours...</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun cours administrable pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      selectedCourseId === course.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                    }`}
                  >
                    <p className="font-medium">{course.title}</p>
                    <p className="text-xs opacity-80 mt-1">
                        {parseCourseMeta(course.topics).formationName} • Cours #{parseCourseMeta(course.topics).courseIndex} • Niveau: {course.level}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background p-4 space-y-3">
            <label className="space-y-1 text-sm block">
              <span>Titre du cours</span>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2"
                value={courseForm.title}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm block">
              <span>Description</span>
              <textarea
                className="w-full rounded-lg border bg-background px-3 py-2 min-h-24"
                value={courseForm.description}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-sm block">
                <span>Formation</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  value={courseForm.formationName}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, formationName: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm block">
                <span>Ordre du cours</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  value={courseForm.courseIndex}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, courseIndex: Number(event.target.value) || 1 }))}
                />
              </label>

              <label className="space-y-1 text-sm block">
                <span>Niveau</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  value={courseForm.level}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, level: event.target.value }))}
                />
              </label>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <label className="space-y-1 text-sm block">
                <span>Durée</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  placeholder="ex: 4 semaines"
                  value={courseForm.duration}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, duration: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm block">
                <span>Modules</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  value={courseForm.modules}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, modules: Number(event.target.value) }))}
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span>Liens YouTube (séparés par virgule)</span>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2"
                placeholder="https://youtube.com/watch?v=... , https://youtu.be/..."
                value={courseForm.topicsCsv}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, topicsCsv: event.target.value }))}
              />
            </label>

            <p className="text-xs text-muted-foreground">
              Les liens YouTube ajoutés ici seront affichés automatiquement dans la page publique du cours.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={courseSaving}
                onClick={createCourse}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-70"
              >
                <Plus className="h-4 w-4" /> Ajouter
              </button>

              <button
                type="button"
                disabled={courseSaving || !selectedCourseId}
                onClick={updateCourse}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-70"
              >
                <Save className="h-4 w-4" /> Mettre à jour
              </button>

              <button
                type="button"
                disabled={courseSaving || !selectedCourseId}
                onClick={deleteCourse}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-70"
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId(null);
                  setCourseForm(emptyCourseForm);
                }}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Nouveau formulaire
              </button>
            </div>

            {coursesMessage && <p className="text-sm text-muted-foreground">{coursesMessage}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
