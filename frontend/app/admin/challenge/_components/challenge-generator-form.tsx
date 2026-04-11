import { Button } from '@/components/ui/button';
import { Braces, Sparkles, Timer, WandSparkles } from 'lucide-react';
import { ChallengeForm, FormationOption } from './types';

type Props = {
  form: ChallengeForm;
  formations: FormationOption[];
  generating: boolean;
  onChange: (updater: (prev: ChallengeForm) => ChallengeForm) => void;
  onGenerate: () => void;
};

export default function ChallengeGeneratorForm({ form, formations, generating, onChange, onGenerate }: Props) {
  return (
    <div className="rounded-xl border p-2.5 space-y-2.5 bg-card/40">
      <p className="text-sm font-semibold inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Paramètres de génération IA</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm space-y-1">
          <span>Titre / thème</span>
          <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.title} onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))} placeholder="ex: Fonctions Python - niveau 1" />
        </label>

        <label className="block text-sm space-y-1">
          <span>Formation liée (DB)</span>
          <select
            className="w-full rounded-lg border px-3 py-2 bg-background"
            value={form.formationId}
            onChange={(e) => {
              const picked = formations.find((item) => item.id === e.target.value);
              onChange((p) => ({
                ...p,
                formationId: e.target.value,
                formationName: picked?.name ?? 'Formation générale',
              }));
            }}
          >
            <option value="">Formation générale</option>
            {formations.map((formation) => (
              <option key={formation.id} value={formation.id}>{formation.name}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm space-y-1">
        <span>Objectif pédagogique / description</span>
        <textarea className="w-full rounded-lg border px-3 py-2 bg-background min-h-16" value={form.description} onChange={(e) => onChange((p) => ({ ...p, description: e.target.value }))} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block text-sm space-y-1">
          <span>Type</span>
          <select className="w-full rounded-lg border px-3 py-2 bg-background" value={form.kind} onChange={(e) => onChange((p) => ({ ...p, kind: e.target.value as ChallengeForm['kind'] }))}>
            <option value="code">Exercice code</option>
            <option value="theory">Exercice théorique</option>
          </select>
        </label>

        <label className="block text-sm space-y-1">
          <span>Niveau</span>
          <select className="w-full rounded-lg border px-3 py-2 bg-background" value={form.difficulty} onChange={(e) => onChange((p) => ({ ...p, difficulty: e.target.value as ChallengeForm['difficulty'] }))}>
            <option value="débutant">Débutant</option>
            <option value="intermédiaire">Intermédiaire</option>
            <option value="avancé">Avancé</option>
          </select>
        </label>

        <label className="block text-sm space-y-1">
          <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> Temps (min)</span>
          <input type="number" min={5} max={240} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.estimatedMinutes} onChange={(e) => onChange((p) => ({ ...p, estimatedMinutes: Number(e.target.value) || 20 }))} />
        </label>

        <label className="block text-sm space-y-1">
          <span>Points</span>
          <input type="number" min={0} max={1000} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.points} onChange={(e) => onChange((p) => ({ ...p, points: Number(e.target.value) || 0 }))} />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {form.kind === 'theory' ? (
          <label className="block text-sm space-y-1">
            <span>Nombre de questions</span>
            <input type="number" min={3} max={20} className="w-full rounded-lg border px-3 py-2 bg-background" value={form.theoryQuestionCount} onChange={(e) => onChange((p) => ({ ...p, theoryQuestionCount: Number(e.target.value) || 6 }))} />
            <p className="text-[11px] text-muted-foreground">Mélange auto: QCM + True/False + Texte.</p>
          </label>
        ) : (
          <label className="block text-sm space-y-1">
            <span className="inline-flex items-center gap-1"><Braces className="h-3.5 w-3.5" /> Langage</span>
            <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.language} onChange={(e) => onChange((p) => ({ ...p, language: e.target.value }))} />
          </label>
        )}

        <label className="block text-sm space-y-1">
          <span>Tags (virgules)</span>
          <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.tagsText} onChange={(e) => onChange((p) => ({ ...p, tagsText: e.target.value }))} placeholder="boucles, fonctions, conditions" />
        </label>
      </div>

      <Button variant="secondary" onClick={onGenerate} disabled={generating}>
        <WandSparkles className="h-4 w-4" /> {generating ? 'Génération IA...' : 'Générer le challenge avec IA'}
      </Button>
    </div>
  );
}