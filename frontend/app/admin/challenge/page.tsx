'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../_components/admin-shell';
import ChallengeSidebarList from './_components/challenge-sidebar-list';
import ChallengeGeneratorForm from './_components/challenge-generator-form';
import ChallengeEditorPanel from './_components/challenge-editor-panel';
import ChallengeAnalyticsPanel from './_components/challenge-analytics-panel';
import CreateChallengeModal from './_components/create-challenge-modal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ChallengeForm, ChallengePayload, ChallengeRow, FormationOption, TheoryQuestion } from './_components/types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const emptyForm: ChallengeForm = {
  title: '',
  description: '',
  difficulty: 'intermédiaire',
  kind: 'code',
  theoryFormat: 'mixed',
  theoryQuestionCount: 6,
  estimatedMinutes: 20,
  points: 50,
  language: 'Python',
  formationId: '',
  formationName: '',
  tagsText: '',
  hint1: '',
  hint2: '',
  starterCode: '',
  case1Input: '',
  case1Expected: '',
  case2Input: '',
  case2Expected: '',
  case3Input: '',
  case3Expected: '',
  isPublished: false,
};

function splitTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function buildPayload(form: ChallengeForm): ChallengePayload {
  const testCases = [
    { label: 'Cas 1', input: form.case1Input.trim(), expected: form.case1Expected.trim() },
    { label: 'Cas 2', input: form.case2Input.trim(), expected: form.case2Expected.trim() },
    { label: 'Cas 3', input: form.case3Input.trim(), expected: form.case3Expected.trim() },
  ].filter((item) => item.input || item.expected);

  return {
    title: form.title,
    description: form.description,
    difficulty: form.difficulty,
    kind: form.kind,
    theoryFormat: form.kind === 'theory' ? 'mixed' : null,
    theoryQuestionCount: form.kind === 'theory' ? Math.max(3, Math.min(20, form.theoryQuestionCount)) : 0,
    estimatedMinutes: form.estimatedMinutes,
    points: form.points,
    language: form.kind === 'code' ? form.language : 'Théorie',
    formationId: form.formationId || null,
    formationName: form.formationName || 'Formation générale',
    tags: splitTags(form.tagsText),
    hints: [form.hint1, form.hint2].map((item) => item.trim()).filter(Boolean),
    starterCode: form.starterCode,
    testCases,
    quizQuestions: [],
    generatedPrompt: `${form.title}\n${form.description}`,
    generationSource: form.kind === 'theory' ? 'generate-quiz' : 'generate-challenge',
    isPublished: form.isPublished,
  };
}

function fromRow(row: ChallengeRow): ChallengeForm {
  return {
    title: row.title,
    description: row.description ?? '',
    difficulty: (row.difficulty as ChallengeForm['difficulty']) || 'intermédiaire',
    kind: row.kind ?? 'code',
    theoryFormat: 'mixed',
    theoryQuestionCount: row.theoryQuestionCount ?? Math.max(3, row.quizQuestions?.length || 6),
    estimatedMinutes: row.estimatedMinutes ?? 20,
    points: row.points,
    language: row.language || 'Python',
    formationId: row.formationId ?? '',
    formationName: row.formationName ?? 'Formation générale',
    tagsText: (row.tags ?? []).join(', '),
    hint1: row.hints?.[0] ?? '',
    hint2: row.hints?.[1] ?? '',
    starterCode: row.starterCode ?? '',
    case1Input: row.testCases?.[0]?.input ?? '',
    case1Expected: row.testCases?.[0]?.expected ?? '',
    case2Input: row.testCases?.[1]?.input ?? '',
    case2Expected: row.testCases?.[1]?.expected ?? '',
    case3Input: row.testCases?.[2]?.input ?? '',
    case3Expected: row.testCases?.[2]?.expected ?? '',
    isPublished: Boolean(row.isPublished),
  };
}

function parseGeneratedChallenge(raw: unknown, currentDifficulty: ChallengeForm['difficulty']) {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const challenge = typeof data.challenge === 'string' ? data.challenge : '';
  const quiz = Array.isArray(data.quiz) ? data.quiz : [];
  const tests = data.challenge_tests && typeof data.challenge_tests === 'object'
    ? (data.challenge_tests as Record<string, unknown>)
    : null;

  let title = 'Challenge IA';
  const description = challenge || 'Challenge généré par IA.';
  const lines = challenge
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => /^#+\s*/.test(line)) ?? lines[0] ?? '';
  if (heading) {
    title = heading.replace(/^#+\s*/, '').slice(0, 90) || title;
  }

  const starter = typeof data.starter_code === 'string'
    ? data.starter_code
    : typeof tests?.starter_code === 'string'
      ? String(tests?.starter_code)
      : '';

  const testCases = Array.isArray(tests?.test_cases)
    ? tests?.test_cases.slice(0, 3).map((item, index) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          label: typeof row.name === 'string' ? row.name : `Cas ${index + 1}`,
          input: typeof row.args_literal === 'string' ? row.args_literal : '',
          expected: typeof row.expected_literal === 'string' ? row.expected_literal : '',
        };
      })
    : [];

  const hints = Array.isArray(data.hints)
    ? data.hints.filter((item): item is string => typeof item === 'string').slice(0, 2)
    : [];

  const quizQuestions = quiz
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question : '';
      if (!question) return null;
      const choices = Array.isArray(row.choices)
        ? row.choices.filter((choice): choice is string => typeof choice === 'string')
        : [];
      return {
        question,
        choices,
        answer: typeof row.answer === 'string' ? row.answer : '',
        explanation: typeof row.explanation === 'string' ? row.explanation : '',
        format: 'qcm' as const,
      };
    })
    .filter((row): row is Exclude<typeof row, null> => row !== null);

  return {
    title,
    description,
    difficulty: currentDifficulty,
    starter,
    testCases,
    hints,
    quizQuestions,
  };
}

function ensureMixedTheoryFormats(questions: TheoryQuestion[], count: number): TheoryQuestion[] {
  const target = Math.max(3, Math.min(20, count || 6));
  const cycle: Array<'qcm' | 'true_false' | 'free_text'> = ['qcm', 'true_false', 'free_text'];
  const base = questions.slice(0, target);

  while (base.length < target) {
    base.push({
      question: `Question ${base.length + 1}`,
      choices: ['Option A', 'Option B', 'Option C'],
      answer: 'Option A',
      explanation: '',
      format: 'qcm',
    });
  }

  return base.map((item, index) => {
    const format = cycle[index % cycle.length];

    if (format === 'true_false') {
      const answer = /faux|false/i.test(item.answer) ? 'Faux' : 'Vrai';
      return {
        ...item,
        format,
        choices: ['Vrai', 'Faux'],
        answer,
      };
    }

    if (format === 'free_text') {
      return {
        ...item,
        format,
        choices: [],
      };
    }

    return {
      ...item,
      format,
      choices: item.choices.length > 0 ? item.choices : ['Option A', 'Option B', 'Option C'],
    };
  });
}

export default function AdminChallengePage() {
  const [items, setItems] = useState<ChallengeRow[]>([]);
  const [formations, setFormations] = useState<FormationOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ChallengeForm>(emptyForm);
  const [aiQuizQuestions, setAiQuizQuestions] = useState<TheoryQuestion[]>([]);
  const [aiGeneratedReady, setAiGeneratedReady] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ChallengeForm>(emptyForm);
  const [createAiQuizQuestions, setCreateAiQuizQuestions] = useState<TheoryQuestion[]>([]);
  const [createAiGeneratedReady, setCreateAiGeneratedReady] = useState(false);
  const [createShowAdvanced, setCreateShowAdvanced] = useState(false);
  const [createGenerating, setCreateGenerating] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState('');

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/challenges', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error('load_error');
      setItems(data.challenges ?? []);
      setMessage('');
    } catch {
      setMessage('Impossible de charger les exercices.');
    } finally {
      setLoading(false);
    }
  }

  async function loadFormations() {
    try {
      const res = await fetch('/api/admin/formations', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      const options = (data.formations ?? []).map((row: { id: string; name: string }) => ({
        id: row.id,
        name: row.name,
      }));
      setFormations(options);
    } catch {
      setFormations([]);
    }
  }

  useEffect(() => {
    load();
    loadFormations();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm(fromRow(selected));
    setAiQuizQuestions(selected.quizQuestions ?? []);
    setAiGeneratedReady(true);
  }, [selected]);

  async function createItem() {
    if (!aiGeneratedReady) {
      setMessage('Génère d’abord le challenge avec l’IA, puis ajuste si nécessaire.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      payload.quizQuestions = aiQuizQuestions;
      payload.generatedPrompt = `${form.title}\n${form.description}`;
      payload.generationSource = form.kind === 'theory' ? 'generate-quiz' : 'generate-challenge';

      const res = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage('Création impossible. Vérifie le titre.');
        return;
      }
      setMessage('Exercice créé.');
      setSelectedId(data.challenge.id);
      await load();
    } catch {
      setMessage('Erreur réseau pendant la création.');
    } finally {
      setSaving(false);
    }
  }

  async function createItemFromModal() {
    if (!createAiGeneratedReady) {
      setCreateMessage('Génère d’abord le challenge avec l’IA, puis ajuste si nécessaire.');
      return;
    }

    setCreateSaving(true);
    try {
      const payload = buildPayload(createForm);
      payload.quizQuestions = createAiQuizQuestions;
      payload.generatedPrompt = `${createForm.title}\n${createForm.description}`;
      payload.generationSource = createForm.kind === 'theory' ? 'generate-quiz' : 'generate-challenge';

      const res = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setCreateMessage('Création impossible. Vérifie le titre.');
        return;
      }

      setCreateMessage('Exercice créé.');
      setSelectedId(data.challenge.id);
      setCreateOpen(false);
      setCreateForm(emptyForm);
      setCreateAiQuizQuestions([]);
      setCreateAiGeneratedReady(false);
      await load();
    } catch {
      setCreateMessage('Erreur réseau pendant la création.');
    } finally {
      setCreateSaving(false);
    }
  }

  async function updateItem() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const payload = buildPayload(form);
      payload.quizQuestions = aiQuizQuestions;
      payload.generatedPrompt = `${form.title}\n${form.description}`;
      payload.generationSource = form.kind === 'theory' ? 'generate-quiz' : 'generate-challenge';

      const res = await fetch(`/api/admin/challenges/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage('Mise à jour impossible.');
        return;
      }
      setMessage('Exercice mis à jour.');
      await load();
    } catch {
      setMessage('Erreur réseau pendant la mise à jour.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/challenges/${selectedId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMessage('Suppression impossible.');
        return;
      }
      setMessage('Exercice supprimé.');
      setSelectedId(null);
      setForm(emptyForm);
      await load();
    } catch {
      setMessage('Erreur réseau pendant la suppression.');
    } finally {
      setSaving(false);
    }
  }

  async function generateWithAI() {
    setGenerating(true);
    setMessage('');
    try {
      const isTheory = form.kind === 'theory';
      const requestedQuestionCount = Math.max(3, Math.min(20, form.theoryQuestionCount));
      const res = await fetch(
        `${apiBaseUrl}/${isTheory ? 'generate-quiz/' : 'generate-challenge/'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isTheory
              ? {
                  theme: form.title || form.description || 'Exercice théorique',
                  level: form.difficulty,
                  nb_questions: requestedQuestionCount,
                  pedagogy_context: {
                    level: form.difficulty,
                    pedagogicalStyle: 'Mélange obligatoire: QCM + Vrai/Faux + Questions ouvertes',
                    aiTone: 'Coach pédagogique clair',
                    targetDurationMin: form.estimatedMinutes,
                  },
                }
              : {
                  level: form.difficulty,
                  language: form.language || 'Python',
                  challenge_topic: form.title || 'Exercice code',
                  course_description: form.description || '',
                  pedagogy_context: {
                    level: form.difficulty,
                    pedagogicalStyle: 'Challenge concret, progressif, testable',
                    aiTone: 'Coach exigeant et bienveillant',
                    targetDurationMin: form.estimatedMinutes,
                  },
                }
          ),
        }
      );

      if (!res.ok) {
        setMessage('Génération IA indisponible pour le moment.');
        return;
      }

      const data = await res.json();
      const generated = parseGeneratedChallenge(data, form.difficulty);
      if (!generated) {
        setMessage('Réponse IA invalide, réessaie.');
        return;
      }

      const pickedFormation = formations.find((item) => item.id === form.formationId);

      const finalQuiz = isTheory
        ? ensureMixedTheoryFormats(generated.quizQuestions, requestedQuestionCount)
        : generated.quizQuestions;

      setForm((prev) => ({
        ...prev,
        title: generated.title || prev.title,
        description: generated.description || prev.description,
        formationName: pickedFormation?.name || prev.formationName || 'Formation générale',
        starterCode: generated.starter || prev.starterCode,
        hint1: generated.hints[0] ?? prev.hint1,
        hint2: generated.hints[1] ?? prev.hint2,
        case1Input: generated.testCases[0]?.input ?? prev.case1Input,
        case1Expected: generated.testCases[0]?.expected ?? prev.case1Expected,
        case2Input: generated.testCases[1]?.input ?? prev.case2Input,
        case2Expected: generated.testCases[1]?.expected ?? prev.case2Expected,
        case3Input: generated.testCases[2]?.input ?? prev.case3Input,
        case3Expected: generated.testCases[2]?.expected ?? prev.case3Expected,
      }));
      setAiQuizQuestions(finalQuiz.slice(0, requestedQuestionCount));
      setAiGeneratedReady(true);
      setMessage('Challenge IA généré. Tu peux ajuster puis publier.');
    } catch {
      setMessage('Erreur lors de la génération IA.');
    } finally {
      setGenerating(false);
    }
  }

  async function generateWithAIForCreate() {
    setCreateGenerating(true);
    setCreateMessage('');
    try {
      const isTheory = createForm.kind === 'theory';
      const requestedQuestionCount = Math.max(3, Math.min(20, createForm.theoryQuestionCount));
      const res = await fetch(
        `${apiBaseUrl}/${isTheory ? 'generate-quiz/' : 'generate-challenge/'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isTheory
              ? {
                  theme: createForm.title || createForm.description || 'Exercice théorique',
                  level: createForm.difficulty,
                  nb_questions: requestedQuestionCount,
                  pedagogy_context: {
                    level: createForm.difficulty,
                    pedagogicalStyle: 'Mélange obligatoire: QCM + Vrai/Faux + Questions ouvertes',
                    aiTone: 'Coach pédagogique clair',
                    targetDurationMin: createForm.estimatedMinutes,
                  },
                }
              : {
                  level: createForm.difficulty,
                  language: createForm.language || 'Python',
                  challenge_topic: createForm.title || 'Exercice code',
                  course_description: createForm.description || '',
                  pedagogy_context: {
                    level: createForm.difficulty,
                    pedagogicalStyle: 'Challenge concret, progressif, testable',
                    aiTone: 'Coach exigeant et bienveillant',
                    targetDurationMin: createForm.estimatedMinutes,
                  },
                }
          ),
        }
      );

      if (!res.ok) {
        setCreateMessage('Génération IA indisponible pour le moment.');
        return;
      }

      const data = await res.json();
      const generated = parseGeneratedChallenge(data, createForm.difficulty);
      if (!generated) {
        setCreateMessage('Réponse IA invalide, réessaie.');
        return;
      }

      const pickedFormation = formations.find((item) => item.id === createForm.formationId);

      const finalQuiz = isTheory
        ? ensureMixedTheoryFormats(generated.quizQuestions, requestedQuestionCount)
        : generated.quizQuestions;

      setCreateForm((prev) => ({
        ...prev,
        title: generated.title || prev.title,
        description: generated.description || prev.description,
        formationName: pickedFormation?.name || prev.formationName || 'Formation générale',
        starterCode: generated.starter || prev.starterCode,
        hint1: generated.hints[0] ?? prev.hint1,
        hint2: generated.hints[1] ?? prev.hint2,
        case1Input: generated.testCases[0]?.input ?? prev.case1Input,
        case1Expected: generated.testCases[0]?.expected ?? prev.case1Expected,
        case2Input: generated.testCases[1]?.input ?? prev.case2Input,
        case2Expected: generated.testCases[1]?.expected ?? prev.case2Expected,
        case3Input: generated.testCases[2]?.input ?? prev.case3Input,
        case3Expected: generated.testCases[2]?.expected ?? prev.case3Expected,
      }));
      setCreateAiQuizQuestions(finalQuiz.slice(0, requestedQuestionCount));
      setCreateAiGeneratedReady(true);
      setCreateMessage('Challenge IA généré. Tu peux ajuster puis créer.');
    } catch {
      setCreateMessage('Erreur lors de la génération IA.');
    } finally {
      setCreateGenerating(false);
    }
  }

  return (
    <AdminShell showActions={false}>
      <div className="space-y-3">
        <section className="rounded-2xl border bg-card p-4 lg:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wide">Studio Exercices</p>
              <h2 className="font-semibold text-xl mt-1">Création et publication</h2>
              <p className="text-sm text-muted-foreground mt-1">Workflow compact: générer, éditer, publier.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Button
                size="sm"
                onClick={() => {
                  setCreateOpen(true);
                  setCreateForm(emptyForm);
                  setCreateAiQuizQuestions([]);
                  setCreateAiGeneratedReady(false);
                  setCreateShowAdvanced(false);
                  setCreateMessage('');
                }}
              >
                <Plus className="h-4 w-4" /> Nouveau challenge
              </Button>
              <span className="rounded-md border bg-background px-2 py-1">{items.length} exos</span>
              <span className="rounded-md border bg-background px-2 py-1">{items.filter((item) => item.isPublished).length} publiés</span>
              <span className={`rounded-md border px-2 py-1 ${aiGeneratedReady ? 'border-primary/30 bg-primary/10 text-primary' : 'bg-background'}`}>
                {aiGeneratedReady ? 'IA prête' : 'IA requise'}
              </span>
            </div>
          </div>
        </section>

        <ChallengeAnalyticsPanel />

        <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-[280px,1fr] gap-3 items-start">
          <ChallengeSidebarList loading={loading} items={items} selectedId={selectedId} onSelect={setSelectedId} />

          <div className="rounded-xl border bg-background p-3 space-y-3">
            <ChallengeGeneratorForm
              form={form}
              formations={formations}
              generating={generating}
              onChange={(updater) => setForm((prev) => updater(prev))}
              onGenerate={generateWithAI}
            />

            <ChallengeEditorPanel
              mode="edit"
              form={form}
              aiQuizQuestions={aiQuizQuestions}
              aiGeneratedReady={aiGeneratedReady}
              showAdvanced={showAdvanced}
              saving={saving}
              selectedId={selectedId}
              message={message}
              onToggleAdvanced={() => setShowAdvanced((value) => !value)}
              onChange={(updater) => setForm((prev) => updater(prev))}
              onCreate={createItem}
              onUpdate={updateItem}
              onDelete={deleteItem}
              onReset={() => {
                setSelectedId(null);
                setForm(emptyForm);
                setAiQuizQuestions([]);
                setAiGeneratedReady(false);
                setMessage('Nouveau brouillon prêt.');
              }}
            />
          </div>
        </div>
        </section>

        <CreateChallengeModal
          open={createOpen}
          form={createForm}
          formations={formations}
          aiQuizQuestions={createAiQuizQuestions}
          aiGeneratedReady={createAiGeneratedReady}
          showAdvanced={createShowAdvanced}
          generating={createGenerating}
          saving={createSaving}
          message={createMessage}
          onClose={() => setCreateOpen(false)}
          onToggleAdvanced={() => setCreateShowAdvanced((value) => !value)}
          onChange={(updater) => setCreateForm((prev) => updater(prev))}
          onGenerate={generateWithAIForCreate}
          onCreate={createItemFromModal}
          onReset={() => {
            setCreateForm(emptyForm);
            setCreateAiQuizQuestions([]);
            setCreateAiGeneratedReady(false);
            setCreateMessage('Nouveau brouillon prêt.');
          }}
        />
      </div>
    </AdminShell>
  );
}