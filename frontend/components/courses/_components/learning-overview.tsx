'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CircleHelp, Volume2 } from 'lucide-react';
import { AdaptiveLevel, SequenceStep } from './personalized-types';

type LearningOverviewProps = {
  adaptiveLevel: AdaptiveLevel;
  strictValidatedFromServer: boolean;
  checkpointDurationMin: number | null;
  quizCompleted: boolean;
  quizScorePercent: number;
  challengeRetries: number;
  dominantBlocker: string;
  motivationalMessage: string;
  isLoadingMotivation: boolean;
  nextSequence: SequenceStep[];
  onSpeakBriefSummary: () => void;
  isAudioSupported: boolean;
  isAudioPlaying: boolean;
  audioMessage: string | null;
};

export default function LearningOverview({
  adaptiveLevel,
  strictValidatedFromServer,
  checkpointDurationMin,
  quizCompleted,
  quizScorePercent,
  challengeRetries,
  dominantBlocker,
  motivationalMessage,
  isLoadingMotivation,
  nextSequence,
  onSpeakBriefSummary,
  isAudioSupported,
  isAudioPlaying,
  audioMessage,
}: LearningOverviewProps) {
  const compactSteps = [
    { label: 'Avant', value: 'Résumé' },
    { label: 'Pendant', value: 'Checkpoint' },
    { label: 'Après', value: 'Challenge' },
    { label: 'Blocage', value: 'Debugger' },
  ];

  return (
    <section className="rounded-xl border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</p>
          <span className="text-xs text-muted-foreground">Apprendre → Tester → Corriger → Rejouer</span>
          <span title="Parcours recommandé: commence par le résumé, valide au checkpoint, corrige via debugger/corrector, puis rejoue le challenge.">
            <CircleHelp className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>
        <span className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium">Niveau: {adaptiveLevel}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
        {compactSteps.map((step) => (
          <div key={step.label} className="rounded-md border bg-background px-2 py-1.5">
            <p className="font-medium leading-tight">{step.label}</p>
            <p className="text-muted-foreground leading-tight">{step.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onSpeakBriefSummary}
          className="h-7 px-2.5 text-xs inline-flex items-center gap-1.5"
          title={isAudioSupported ? 'Lire le résumé audio' : 'Audio non pris en charge sur ce navigateur'}
        >
          <Volume2 className="h-3.5 w-3.5" /> {isAudioPlaying ? 'Arrêter audio' : 'Résumé audio'}
        </Button>
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${strictValidatedFromServer ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
          {strictValidatedFromServer ? 'Validé' : 'Validation en attente'}
        </span>
      </div>

      {audioMessage && (
        <div className="rounded-md border bg-background p-2 text-[11px] text-muted-foreground">{audioMessage}</div>
      )}

      {nextSequence.length > 0 && (
        <div className="rounded-md border bg-background p-2 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prochaine séquence</p>
          {nextSequence.map((item) => (
            <div key={`${item.step}-${item.href}`} className="rounded-md border bg-card p-1.5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium">{item.step}</p>
                <p className="text-[11px] text-muted-foreground">{item.reason}</p>
              </div>
              {item.href.startsWith('/') ? (
                <Link href={item.href} className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] hover:bg-accent">
                  {item.cta}
                </Link>
              ) : (
                <a href={item.href} className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] hover:bg-accent">
                  {item.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-md border bg-background p-2">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            Temps checkpoint
            <span title="Temps total du dernier checkpoint terminé.">
              <CircleHelp className="h-3 w-3" />
            </span>
          </p>
          <p className="text-xs font-semibold">{checkpointDurationMin ? `${checkpointDurationMin} min` : '—'}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            Réussite quiz
            <span title="Score du dernier quiz checkpoint.">
              <CircleHelp className="h-3 w-3" />
            </span>
          </p>
          <p className="text-xs font-semibold">{quizCompleted ? `${quizScorePercent}%` : '—'}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            Retries challenge
            <span title="Nombre de tentatives enregistrées sur le mini challenge.">
              <CircleHelp className="h-3 w-3" />
            </span>
          </p>
          <p className="text-xs font-semibold">{challengeRetries}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            Blocage dominant
            <span title="Type de difficulté détectée à partir de tes retours récents.">
              <CircleHelp className="h-3 w-3" />
            </span>
          </p>
          <p className="text-xs font-semibold">{dominantBlocker}</p>
        </div>
      </div>

      {(motivationalMessage || isLoadingMotivation) && (
        <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
          {isLoadingMotivation ? 'Génération du message motivant...' : motivationalMessage}
        </div>
      )}
    </section>
  );
}
