import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ChallengeForm, TheoryQuestion } from './types';

type Props = {
  mode?: 'create' | 'edit';
  form: ChallengeForm;
  aiQuizQuestions: TheoryQuestion[];
  aiGeneratedReady: boolean;
  showAdvanced: boolean;
  saving: boolean;
  selectedId: string | null;
  message: string;
  onToggleAdvanced: () => void;
  onChange: (updater: (prev: ChallengeForm) => ChallengeForm) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onReset: () => void;
};

export default function ChallengeEditorPanel({
  mode = 'edit',
  form,
  aiQuizQuestions,
  aiGeneratedReady,
  showAdvanced,
  saving,
  selectedId,
  message,
  onToggleAdvanced,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  onReset,
}: Props) {
  const isCreateMode = mode === 'create';

  return (
    <>
      {!aiGeneratedReady && (
        <p className="text-xs text-muted-foreground rounded-md border bg-card px-2.5 py-2">
          Génère d’abord avec l’IA. Ensuite tu peux modifier avant d’enregistrer en base.
        </p>
      )}

      {form.kind === 'theory' && aiQuizQuestions.length > 0 && (
        <div className="rounded-lg border p-2 space-y-2">
          <p className="text-sm font-medium">Questions générées ({aiQuizQuestions.length})</p>
          <div className="space-y-2 max-h-48 overflow-auto">
            {aiQuizQuestions.map((question, index) => (
              <div key={`${question.question}-${index}`} className="rounded-md border bg-card p-2">
                <p className="text-xs font-semibold">{index + 1}. [{question.format}] {question.question}</p>
                {question.choices.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Choix: {question.choices.join(' • ')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
        <p className="text-xs text-muted-foreground">Édition avancée (optionnel)</p>
        <Button variant="outline" size="sm" onClick={onToggleAdvanced}>
          <SlidersHorizontal className="h-4 w-4" /> {showAdvanced ? 'Masquer' : 'Afficher'}
        </Button>
      </div>

      {showAdvanced && (
        <div className="space-y-2.5 rounded-lg border p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm space-y-1">
              <span>Titre de l’exercice</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.title} onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))} />
            </label>

            <label className="block text-sm space-y-1">
              <span>Formation (texte)</span>
              <input className="w-full rounded-lg border px-3 py-2 bg-background" value={form.formationName} onChange={(e) => onChange((p) => ({ ...p, formationName: e.target.value }))} />
            </label>
          </div>

          <label className="block text-sm space-y-1">
            <span>Consigne / Description</span>
            <textarea className="w-full rounded-lg border px-3 py-2 bg-background min-h-20" value={form.description} onChange={(e) => onChange((p) => ({ ...p, description: e.target.value }))} />
          </label>

          {form.kind === 'code' && (
            <label className="block text-sm space-y-1">
              <span>Starter code</span>
              <textarea className="w-full rounded-lg border px-3 py-2 bg-background min-h-20 font-mono text-xs" value={form.starterCode} onChange={(e) => onChange((p) => ({ ...p, starterCode: e.target.value }))} />
            </label>
          )}
        </div>
      )}

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isPublished} onChange={(e) => onChange((p) => ({ ...p, isPublished: e.target.checked }))} />
        Publier l’exercice (visible élèves)
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={onCreate} disabled={saving || !aiGeneratedReady}>
          <Plus className="h-4 w-4" /> {isCreateMode ? 'Créer le challenge' : 'Enregistrer en base'}
        </Button>
        {!isCreateMode && (
          <Button variant="outline" onClick={onUpdate} disabled={!selectedId || saving}>
            <Save className="h-4 w-4" /> Mettre à jour
          </Button>
        )}
        {!isCreateMode && (
          <Button variant="outline" onClick={onDelete} disabled={!selectedId || saving}>
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        )}
        <Button variant="outline" onClick={onReset}>
          {isCreateMode ? 'Réinitialiser' : 'Nouveau'}
        </Button>
        {!isCreateMode && (
          <Button variant="outline" onClick={() => onChange((prev) => ({ ...prev, isPublished: !prev.isPublished }))}>
            {form.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {form.isPublished ? 'Passer en brouillon' : 'Marquer publié'}
          </Button>
        )}
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </>
  );
}