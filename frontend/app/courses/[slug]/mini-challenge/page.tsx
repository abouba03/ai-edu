'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { ArrowLeft, ChevronLeft, ChevronRight, Code2, RefreshCw, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/event-tracker';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function levelToQuiz(level: string): 'débutant' | 'intermédiaire' | 'avancé' {
  const normalized = level.toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

export default function CourseMiniChallengePage() {
  const { userId } = useAuth();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const courseSlug = params?.slug ?? '';
  const courseTitle = searchParams.get('title') || 'Cours';
  const courseLevel = searchParams.get('level') || 'débutant';
  const formationName = searchParams.get('formation') || 'Formation';
  const progressPercent = Number(searchParams.get('progress') || '0');

  const [challenge, setChallenge] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeFeedback, setChallengeFeedback] = useState('');
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

  const pages = ['Description', 'Contraintes', 'Hints'] as const;
  const [instructionPage, setInstructionPage] = useState(0);

  const parsedChallengeFeedback = useMemo(() => {
    const raw = challengeFeedback.trim();
    if (!raw) {
      return {
        promptVersion: null as string | null,
        note: null as string | null,
        comment: '',
        consignes: [] as string[],
        idees: [] as string[],
        nextSteps: [] as string[],
        extra: '',
        raw: '',
      };
    }

    const normalized = raw.startsWith('```')
      ? raw.replace(/^```(?:json|python)?\n?/i, '').replace(/```$/i, '').trim()
      : raw;

    try {
      const parsed = JSON.parse(normalized) as {
        prompt_version?: string;
        note?: string;
        commentaire?: string;
        comment?: string;
        consignes?: string[];
        idees?: string[];
        prochaines_etapes?: string[];
      };

      const jsonComment = (parsed.commentaire ?? parsed.comment ?? '').trim();
      const consignes = Array.isArray(parsed.consignes) ? parsed.consignes.filter((item): item is string => typeof item === 'string') : [];
      const idees = Array.isArray(parsed.idees) ? parsed.idees.filter((item): item is string => typeof item === 'string') : [];
      const nextSteps = Array.isArray(parsed.prochaines_etapes)
        ? parsed.prochaines_etapes.filter((item): item is string => typeof item === 'string')
        : [];

      return {
        promptVersion: parsed.prompt_version ?? null,
        note: parsed.note?.trim() ?? null,
        comment: jsonComment,
        consignes,
        idees,
        nextSteps,
        extra: '',
        raw,
      };
    } catch {
      // fallback text parsing below
    }

    const noteMatch = raw.match(/Note:\s*([^\n]+)/i);

    const withoutNote = raw.replace(/Note:\s*[^\n]+\n?/i, '').trim();
    const withoutCode = withoutNote.replace(/```(?:python)?\n[\s\S]*?```/i, '').trim();

    const commentMatch = withoutCode.match(/Commentaire:\s*([\s\S]*)/i);
    const comment = commentMatch ? commentMatch[1].trim() : withoutCode;

    let extra = '';
    if (commentMatch) {
      const commentBlock = commentMatch[0];
      extra = withoutCode.replace(commentBlock, '').trim();
    }

    return {
      promptVersion: null,
      note: noteMatch ? noteMatch[1].trim() : null,
      comment,
      consignes: [],
      idees: [],
      nextSteps: [],
      extra,
      raw,
    };
  }, [challengeFeedback]);

  async function generateMiniChallenge() {
    setIsGeneratingChallenge(true);
    setChallengeFeedback('');

    await trackEvent({
      action: 'mini_challenge_generated',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: { courseSlug, courseTitle },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
        level: levelToQuiz(courseLevel),
        language: 'Python',
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          progressPercent,
          aiTone: 'Coach challengeant bienveillant',
          pedagogicalStyle: 'Challenge contextualisé au cours avec format coding challenge',
          targetAudience: formationName,
          passThreshold: 70,
          weeklyGoalHours: 5,
        },
      });

      setChallenge(res.data.challenge ?? '');
      setChallengeCode('');
      setInstructionPage(0);

      await trackEvent({
        action: 'mini_challenge_generated',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: { courseSlug },
      });
    } catch {
      setChallenge('Impossible de générer le challenge pour le moment.');
      await trackEvent({
        action: 'mini_challenge_generated',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: { courseSlug },
      });
    } finally {
      setIsGeneratingChallenge(false);
    }
  }

  async function submitMiniChallenge() {
    if (!challenge.trim() || !challengeCode.trim()) return;

    setIsSubmittingChallenge(true);
    await trackEvent({
      action: 'mini_challenge_submitted',
      feature: 'course_mini_challenge_page',
      status: 'start',
      metadata: { courseSlug, codeLength: challengeCode.length },
    });

    try {
      const res = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: challenge,
        student_code: challengeCode,
        pedagogy_context: {
          level: levelToQuiz(courseLevel),
          progressPercent,
          aiTone: 'Évaluateur pédagogique précis',
          pedagogicalStyle: 'Correction explicative orientée progression',
          targetAudience: formationName,
          passThreshold: 70,
          weeklyGoalHours: 5,
        },
      });

      setChallengeFeedback(res.data.evaluation ?? '');

      try {
        await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'challenge',
            actorClerkId: userId ?? undefined,
            courseSlug,
            courseTitle,
            challengeText: challenge,
            submittedCode: challengeCode,
            evaluation: res.data.evaluation_json ?? { evaluation: res.data.evaluation ?? '' },
            status: 'success',
          }),
        });
      } catch {
        // keep silent: persistence must not block UX
      }

      await trackEvent({
        action: 'mini_challenge_submitted',
        feature: 'course_mini_challenge_page',
        status: 'success',
        metadata: { courseSlug, codeLength: challengeCode.length },
      });
    } catch {
      setChallengeFeedback('Échec de la correction IA.');
      await trackEvent({
        action: 'mini_challenge_submitted',
        feature: 'course_mini_challenge_page',
        status: 'error',
        metadata: { courseSlug, codeLength: challengeCode.length },
      });
    } finally {
      setIsSubmittingChallenge(false);
    }
  }

  useEffect(() => {
    generateMiniChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const instructionBody = useMemo(() => {
    if (pages[instructionPage] === 'Description') {
      return challenge || 'Clique sur “Nouveau challenge” pour générer un énoncé.';
    }

    if (pages[instructionPage] === 'Contraintes') {
      return [
        '1) Écris uniquement du code Python exécutable.',
        '2) Respecte les entrées/sorties demandées dans l’énoncé.',
        '3) Favorise une solution claire et robuste.',
        '4) Gère les cas limites mentionnés dans le challenge.',
      ].join('\n');
    }

    return [
      '• Commence par un exemple simple puis généralise.',
      '• Vérifie les conditions limites avant de soumettre.',
      '• Nomme clairement tes variables et fonctions.',
      '• Si blocage, fais une version minimale fonctionnelle puis améliore.',
    ].join('\n');
  }, [instructionPage, pages, challenge]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <p className="text-sm text-primary font-semibold inline-flex items-center gap-2">
              <Target className="h-4 w-4" /> Mini Challenge du cours
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold">Atelier de résolution guidée</h1>
            <p className="text-sm text-muted-foreground">Format coding challenge adapté au cours {courseTitle}.</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-1">Niveau: {courseLevel}</span>
            <span className="rounded-full border px-2 py-1">Formation: {formationName}</span>
            <span className="rounded-full border px-2 py-1">Progression: {progressPercent}%</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/courses/${courseSlug}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> Retour au cours
          </Link>
          <Button variant="outline" onClick={generateMiniChallenge} disabled={isGeneratingChallenge}>
            <RefreshCw className="h-4 w-4 mr-2" /> {isGeneratingChallenge ? 'Génération...' : 'Nouveau challenge'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-2">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 min-h-[70vh]">
          <aside className="xl:col-span-5 rounded-xl border bg-background p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {pages.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setInstructionPage(index)}
                  className={`rounded-md border px-3 py-1.5 ${instructionPage === index ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2">Page {instructionPage + 1}/{pages.length}</p>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[52vh] overflow-y-auto">{instructionBody}</pre>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={instructionPage === 0}
                onClick={() => setInstructionPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
              </Button>
              <Button
                variant="outline"
                disabled={instructionPage === pages.length - 1}
                onClick={() => setInstructionPage((value) => Math.min(pages.length - 1, value + 1))}
              >
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </aside>

          <div className="xl:col-span-7 rounded-xl border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold inline-flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Solution
              </p>
              <Button onClick={submitMiniChallenge} disabled={isSubmittingChallenge || !challenge.trim() || !challengeCode.trim()}>
                {isSubmittingChallenge ? 'Correction...' : 'Soumettre la solution'}
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Editor
                height="360px"
                defaultLanguage="python"
                value={challengeCode}
                onChange={(value) => setChallengeCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 min-h-36">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Résultat de correction
              </p>

              {parsedChallengeFeedback.note && (
                <p className="text-sm font-semibold">Note: {parsedChallengeFeedback.note}</p>
              )}

              {parsedChallengeFeedback.promptVersion && (
                <p className="text-xs text-muted-foreground">Version prompt: {parsedChallengeFeedback.promptVersion}</p>
              )}

              {parsedChallengeFeedback.comment ? (
                <p className="text-sm whitespace-pre-line leading-relaxed">{parsedChallengeFeedback.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Soumets ton code pour voir le feedback IA.</p>
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

              {!parsedChallengeFeedback.comment
                && parsedChallengeFeedback.consignes.length === 0
                && parsedChallengeFeedback.idees.length === 0
                && parsedChallengeFeedback.nextSteps.length === 0
                && parsedChallengeFeedback.raw && (
                <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
                  {parsedChallengeFeedback.raw}
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
