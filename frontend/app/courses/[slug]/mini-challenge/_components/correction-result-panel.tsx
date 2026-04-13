'use client';

import { CheckCircle2, FlaskConical, Sparkles, XCircle } from 'lucide-react';
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
    <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-3 space-y-3 shadow-[2px_2px_0px_0px_#1C293C] min-h-36">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> Résultat de correction
        </p>
        <div className="inline-flex items-center gap-1.5">
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[11px] font-semibold text-[#1C293C]/60">
            Tentatives: {challengeAttemptCount}
          </span>
          {noteValue !== null && (
            <span className={`border-2 px-2 py-0.5 text-[11px] font-black ${
              challengeValidated
                ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                : 'border-[#1C293C]/20 text-[#1C293C]/60'
            }`}>
              {challengeValidated ? 'Validé' : 'À améliorer'} ({noteValue}/10)
            </span>
          )}
        </div>
      </div>

      {/* ── METADATA ── */}
      {(parsedChallengeFeedback.note || parsedChallengeFeedback.promptVersion || parsedChallengeFeedback.evaluationMode) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="border-2 border-[#1C293C] bg-white p-2.5">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">Note</p>
            <p className="text-base font-black mt-1 text-[#1C293C]">{parsedChallengeFeedback.note ?? 'N/A'}</p>
          </div>
          <div className="border-2 border-[#1C293C] bg-white p-2.5">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">Mode</p>
            <p className="text-sm font-black mt-1 capitalize text-[#1C293C]">{parsedChallengeFeedback.evaluationMode ?? 'ia'}</p>
          </div>
          <div className="border-2 border-[#1C293C] bg-white p-2.5">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]/50">Version prompt</p>
            <p className="text-sm font-black mt-1 text-[#1C293C]">{parsedChallengeFeedback.promptVersion ?? '—'}</p>
          </div>
        </div>
      )}

      {/* ── SYNTHÈSE ── */}
      {conciseFeedbackComment ? (
        <div className="border-2 border-[#1C293C] bg-white p-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1.5">Synthèse</p>
          <p className="text-sm whitespace-pre-line leading-relaxed text-[#1C293C]">{conciseFeedbackComment}</p>
        </div>
      ) : (
        <p className="text-sm text-[#1C293C]/60">
          Soumets ton code pour obtenir une correction détaillée (note, points forts, axes d&apos;amélioration).
        </p>
      )}

      {/* ── TESTS ── */}
      {parsedChallengeFeedback.testSummary && parsedChallengeFeedback.testSummary.total > 0 && (
        <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> Résultats des tests automatiques
            </p>
            <span className={`border-2 px-2 py-0.5 text-[11px] font-black ${
              parsedChallengeFeedback.testSummary.all_passed
                ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                : 'border-[#1C293C]/20 text-[#1C293C]/60'
            }`}>
              {parsedChallengeFeedback.testSummary.passed}/{parsedChallengeFeedback.testSummary.total} validés
            </span>
          </div>

          {parsedChallengeFeedback.testSummary.runtime_error && (
            <p className="text-xs text-[#DC2626] font-semibold">{parsedChallengeFeedback.testSummary.runtime_error}</p>
          )}

          {parsedChallengeFeedback.testResults.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {parsedChallengeFeedback.testResults.map((item, index) => (
                <li key={`${item.name}-${index}`} className={`border-2 px-2.5 py-2 space-y-1.5 ${
                  item.status === 'passed' ? 'border-[#16A34A] bg-[#16A34A]/5' : 'border-[#DC2626]/40 bg-[#DC2626]/5'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black inline-flex items-center gap-1.5 text-[#1C293C]">
                      {item.status === 'passed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                      ) : (
                        <XCircle className={`h-3.5 w-3.5 ${item.status === 'error' ? 'text-[#DC2626]' : 'text-[#1C293C]/40'}`} />
                      )}
                      {item.name}
                    </span>
                    <span className={`border px-1.5 py-0.5 text-[10px] font-black ${
                      item.status === 'passed'
                        ? 'border-[#16A34A] text-[#16A34A]'
                        : item.status === 'error'
                        ? 'border-[#DC2626] text-[#DC2626]'
                        : 'border-[#1C293C]/30 text-[#1C293C]/60'
                    }`}>
                      {item.status === 'passed' ? 'validé' : item.status === 'error' ? 'erreur' : 'à corriger'}
                    </span>
                  </div>
                  <div className="border border-[#1C293C]/20 bg-white p-2 space-y-1">
                    <p className="text-[#1C293C]/60">Entrée: {item.input}</p>
                    <p className="text-[#1C293C]/60">Attendu: {item.expected}</p>
                    <p className="text-[#1C293C]/60">Obtenu: {item.actual}</p>
                  </div>
                  {item.error && <p className="text-[#DC2626] font-semibold mt-1">Erreur: {item.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── CONSIGNES ── */}
      {parsedChallengeFeedback.consignes.length > 0 && (
        <div className="border-2 border-[#1C293C] bg-white p-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">Consignes</p>
          <ul className="space-y-1 text-xs text-[#1C293C]">
            {parsedChallengeFeedback.consignes.map((item, index) => (
              <li key={`consigne-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── IDÉES ── */}
      {parsedChallengeFeedback.idees.length > 0 && (
        <div className="border-2 border-[#1C293C] bg-white p-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">Idées</p>
          <ul className="space-y-1 text-xs text-[#1C293C]">
            {parsedChallengeFeedback.idees.map((item, index) => (
              <li key={`idee-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── PROCHAINES ÉTAPES ── */}
      {parsedChallengeFeedback.nextSteps.length > 0 && (
        <div className="border-2 border-[#1C293C] bg-white p-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">Prochaines étapes</p>
          <ul className="space-y-1 text-xs text-[#1C293C]">
            {parsedChallengeFeedback.nextSteps.map((item, index) => (
              <li key={`next-step-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── COACH ── */}
      {coachGuidance && (
        <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">{coachGuidance.title}</p>
          <p className="text-xs text-[#1C293C]/60">{coachGuidance.status}</p>

          <div className="space-y-1.5">
            <p className="text-xs font-black text-[#1C293C]">Priorités maintenant</p>
            <ul className="space-y-1 text-xs text-[#1C293C]">
              {coachGuidance.priorities.map((item, index) => (
                <li key={`coach-priority-${index}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-black text-[#1C293C]">Checklist de prochaine tentative</p>
            <ul className="space-y-1 text-xs text-[#1C293C]">
              {coachGuidance.checklist.map((item, index) => (
                <li key={`coach-check-${index}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[11px] font-semibold text-[#1C293C]/60">
              Debugger disponible dans l&apos;onglet dédié &quot;Debugger&quot;.
            </span>
          </div>
        </div>
      )}

      {/* ── CODE CORRECTOR ── */}
      <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">CodeCorrector intégré</p>
          <span className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-0.5 text-[11px] font-semibold text-[#1C293C]/60">Assistant de correction</span>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={runInlineCorrector}
            disabled={correctorLoading || !challengeCode.trim()}
            className="border-2 border-[#1C293C] bg-[#FBFBF9] px-3 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {correctorLoading ? 'Correction...' : 'Corriger ce code'}
          </button>

          {correctorError && (
            <div className="border-2 border-[#DC2626]/40 bg-[#DC2626]/5 p-2 text-xs text-[#DC2626]">{correctorError}</div>
          )}

          {correctorExplanation && (
            <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 text-xs">
              <p className="font-black text-[#432DD7] mb-1">Explication</p>
              <p className="text-[#1C293C]/70 whitespace-pre-wrap">{sanitizeShortText(correctorExplanation, 400)}</p>
            </div>
          )}

          {correctorHintQuestion && (
            <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2 text-xs">
              <p className="font-black text-[#432DD7] mb-1">Question de vérification</p>
              <p className="text-[#1C293C]/70 whitespace-pre-wrap">{sanitizeShortText(correctorHintQuestion, 220)}</p>
            </div>
          )}

          {correctedCode && (
            <pre className="max-h-44 overflow-y-auto border-2 border-[#1C293C] bg-[#FBFBF9] p-2 text-[11px] whitespace-pre-wrap text-[#1C293C]">{correctedCode}</pre>
          )}
        </div>
      </div>

      {/* ── HISTORIQUE ── */}
      {attemptHistory.length > 0 && (
        <div className="border-2 border-[#1C293C] bg-white p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">3 dernières tentatives</p>
          <ul className="space-y-1.5 text-xs">
            {attemptHistory.map((item, index) => (
              <li key={`${item.at}-${index}`} className={`border-2 px-2 py-1.5 ${
                item.status === 'validated'
                  ? 'border-[#16A34A] bg-[#16A34A]/10'
                  : 'border-[#DC2626]/40 bg-[#DC2626]/5'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-black ${item.status === 'validated' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    #{attemptHistory.length - index} · {item.note}
                  </span>
                  <span className={`border px-1.5 py-0.5 text-[10px] font-black ${
                    item.status === 'validated'
                      ? 'border-[#16A34A] text-[#16A34A]'
                      : 'border-[#DC2626] text-[#DC2626]'
                  }`}>
                    {item.status === 'validated' ? 'validé' : 'à améliorer'}
                  </span>
                </div>
                <p className="text-[#1C293C]/60 mt-1">Focus: {item.focus}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
