'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChallengeGeneratorForm from './challenge-generator-form';
import ChallengeEditorPanel from './challenge-editor-panel';
import { ChallengeForm, FormationOption, TheoryQuestion } from './types';

type Props = {
  open: boolean;
  form: ChallengeForm;
  formations: FormationOption[];
  aiQuizQuestions: TheoryQuestion[];
  aiGeneratedReady: boolean;
  showAdvanced: boolean;
  generating: boolean;
  saving: boolean;
  message: string;
  onClose: () => void;
  onToggleAdvanced: () => void;
  onChange: (updater: (prev: ChallengeForm) => ChallengeForm) => void;
  onGenerate: () => void;
  onCreate: () => void;
  onReset: () => void;
};

export default function CreateChallengeModal({
  open,
  form,
  formations,
  aiQuizQuestions,
  aiGeneratedReady,
  showAdvanced,
  generating,
  saving,
  message,
  onClose,
  onToggleAdvanced,
  onChange,
  onGenerate,
  onCreate,
  onReset,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Fermer la modal" />

      <section className="absolute inset-x-3 top-4 bottom-4 md:inset-x-10 lg:inset-x-20 rounded-2xl border bg-background shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary font-semibold">Nouveau challenge</p>
            <h2 className="text-lg font-semibold">Créer avec IA</h2>
          </div>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="h-[calc(100%-57px)] overflow-auto p-4 space-y-3">
          <ChallengeGeneratorForm
            form={form}
            formations={formations}
            generating={generating}
            onChange={onChange}
            onGenerate={onGenerate}
          />

          <ChallengeEditorPanel
            mode="create"
            form={form}
            aiQuizQuestions={aiQuizQuestions}
            aiGeneratedReady={aiGeneratedReady}
            showAdvanced={showAdvanced}
            saving={saving}
            selectedId={null}
            message={message}
            onToggleAdvanced={onToggleAdvanced}
            onChange={onChange}
            onCreate={onCreate}
            onUpdate={() => undefined}
            onDelete={() => undefined}
            onReset={onReset}
          />
        </div>
      </section>
    </div>
  );
}
