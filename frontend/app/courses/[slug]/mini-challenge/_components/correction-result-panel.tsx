'use client';

import { CheckCircle2, FlaskConical, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttemptHistoryItem, CoachGuidance, ParsedChallengeFeedback } from './types';

type CorrectionResultPanelProps = {
  challengeAttemptCount: number;
  noteValue: number | null;
  challengeValidated: boolean;
  parsedChallengeFeedback: ParsedChallengeFeedback;
  conciseFeedbackComment: string;
  coachGuidance: CoachGuidance | null;
  correctorLoading: boolean;
  challengeCode: string;
  runInlineCorrector: () => Promise<void>;
  correctorError: string;
  correctorExplanation: string;
  correctorHintQuestion: string;
  correctedCode: string;
  sanitizeShortText: (value: string, maxLen?: number) => string;
  attemptHistory: AttemptHistoryItem[];
};

export function CorrectionResultPanel({
  challengeAttemptCount,
  noteValue,
  challengeValidated,
  parsedChallengeFeedback,
  conciseFeedbackComment,
  coachGuidance,
  correctorLoading,
  challengeCode,
  runInlineCorrector,
  correctorError,
  correctorExplanation,
  correctorHintQuestion,
  correctedCode,
  sanitizeShortText,
  attemptHistory,
}: CorrectionResultPanelProps) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3 min-h-36">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Résultat de correction
        </p>
        <div className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
            Tentatives: {challengeAttemptCount}
          </span>
          {noteValue !== null && (
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${challengeValidated ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              {challengeValidated ? 'Validé' : 'À améliorer'} ({noteValue}/10)
            </span>
          )}
        </div>
      </div>

      {(parsedChallengeFeedback.note || parsedChallengeFeedback.promptVersion || parsedChallengeFeedback.evaluationMode) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Note</p>
            <p className="text-base font-semibold mt-1">{parsedChallengeFeedback.note ?? 'N/A'}</p>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</p>
            <p className="text-sm font-medium mt-1 capitalize">{parsedChallengeFeedback.evaluationMode ?? 'ia'}</p>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Version prompt</p>
            <p className="text-sm font-medium mt-1">{parsedChallengeFeedback.promptVersion ?? '—'}</p>
          </div>
        </div>
      )}

      {conciseFeedbackComment ? (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Synthèse</p>
          <p className="text-sm whitespace-pre-line leading-relaxed">{conciseFeedbackComment}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Soumets ton code pour obtenir une correction détaillée (note, points forts, axes d’amélioration).</p>
      )}

      {parsedChallengeFeedback.testSummary && parsedChallengeFeedback.testSummary.total > 0 && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary inline-flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> Résultats des tests automatiques
            </p>
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] ${parsedChallengeFeedback.testSummary.all_passed ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              {parsedChallengeFeedback.testSummary.passed}/{parsedChallengeFeedback.testSummary.total} validés
            </span>
          </div>

          {parsedChallengeFeedback.testSummary.runtime_error && (
            <p className="text-xs text-destructive">{parsedChallengeFeedback.testSummary.runtime_error}</p>
          )}

          {parsedChallengeFeedback.testResults.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {parsedChallengeFeedback.testResults.map((item, index) => (
                <li key={`${item.name}-${index}`} className="rounded-lg border bg-background px-2.5 py-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium inline-flex items-center gap-1.5">
                      {item.status === 'passed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <XCircle className={`h-3.5 w-3.5 ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      )}
                      {item.name}
                    </span>
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] ${item.status === 'passed' ? 'border-primary/30 bg-primary/10 text-primary' : item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {item.status === 'passed' ? 'validé' : item.status === 'error' ? 'erreur' : 'à corriger'}
                    </span>
                  </div>
                  <div className="rounded-md border bg-card p-2 space-y-1">
                    <p className="text-muted-foreground">Entrée: {item.input}</p>
                    <p className="text-muted-foreground">Attendu: {item.expected}</p>
                    <p className="text-muted-foreground">Obtenu: {item.actual}</p>
                  </div>
                  {item.error && <p className="text-destructive mt-1">Erreur: {item.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {parsedChallengeFeedback.consignes.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-2">Consignes</p>
          <ul className="space-y-1 text-xs">
            {parsedChallengeFeedback.consignes.map((item, index) => (
              <li key={`consigne-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsedChallengeFeedback.idees.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-2">Idées</p>
          <ul className="space-y-1 text-xs">
            {parsedChallengeFeedback.idees.map((item, index) => (
              <li key={`idee-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsedChallengeFeedback.nextSteps.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-2">Prochaines étapes</p>
          <ul className="space-y-1 text-xs">
            {parsedChallengeFeedback.nextSteps.map((item, index) => (
              <li key={`next-step-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {coachGuidance && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{coachGuidance.title}</p>
          <p className="text-xs text-muted-foreground">{coachGuidance.status}</p>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Priorités maintenant</p>
            <ul className="space-y-1 text-xs">
              {coachGuidance.priorities.map((item, index) => (
                <li key={`coach-priority-${index}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Checklist de prochaine tentative</p>
            <ul className="space-y-1 text-xs">
              {coachGuidance.checklist.map((item, index) => (
                <li key={`coach-check-${index}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
              Debugger disponible dans l’onglet dédié “Debugger”.
            </span>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">CodeCorrector intégré</p>
          <span className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-muted-foreground">Assistant de correction</span>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="h-7 text-xs" onClick={runInlineCorrector} disabled={correctorLoading || !challengeCode.trim()}>
            {correctorLoading ? 'Correction...' : 'Corriger ce code'}
          </Button>

          {correctorError && (
            <div className="rounded-md border bg-destructive/10 p-2 text-xs text-destructive">{correctorError}</div>
          )}

          {correctorExplanation && (
            <div className="rounded-md border bg-background p-2 text-xs">
              <p className="font-medium mb-1">Explication</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{sanitizeShortText(correctorExplanation, 400)}</p>
            </div>
          )}

          {correctorHintQuestion && (
            <div className="rounded-md border bg-background p-2 text-xs">
              <p className="font-medium mb-1">Question de vérification</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{sanitizeShortText(correctorHintQuestion, 220)}</p>
            </div>
          )}

          {correctedCode && (
            <pre className="max-h-44 overflow-y-auto rounded-md border bg-muted/30 p-2 text-[11px] whitespace-pre-wrap">{correctedCode}</pre>
          )}
        </div>
      </div>

      {attemptHistory.length > 0 && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">3 dernières tentatives</p>
          <ul className="space-y-1.5 text-xs">
            {attemptHistory.map((item, index) => (
              <li key={`${item.at}-${index}`} className="rounded-md border bg-background px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">#{attemptHistory.length - index} · {item.note}</span>
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] ${item.status === 'validated' ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    {item.status === 'validated' ? 'validé' : 'à améliorer'}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">Focus: {item.focus}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
