'use client';

import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ChallengeDuel() {
  const searchParams = useSearchParams();
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [level, setLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>('intermédiaire');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const queryLevel = searchParams.get('level');
    if (queryLevel === 'débutant' || queryLevel === 'intermédiaire' || queryLevel === 'avancé') {
      setLevel(queryLevel);
    }
  }, [searchParams]);

  // Générer un nouveau défi
  const generateChallenge = async () => {
    setLoading(true);
    setError('');
    await trackEvent({ action: 'generate_challenge', feature: 'challenge', status: 'start' });
    try {
      const res = await axios.post(`${apiBaseUrl}/generate-challenge/`, {
        level,
        language: 'Python',
        pedagogy_context: {
          level,
          pedagogicalStyle: 'Micro challenge orienté pratique',
          aiTone: 'Coach challengeant mais bienveillant',
        },
      });
      setChallenge(res.data.challenge);
      setCode('');
      setEvaluation('');
      await trackEvent({ action: 'generate_challenge', feature: 'challenge', status: 'success' });
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setChallenge('');
      setError(detail || "Erreur lors de la génération du défi.");
      await trackEvent({ action: 'generate_challenge', feature: 'challenge', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Soumettre la solution de l'étudiant
  const submitSolution = async () => {
    setLoading(true);
    setError('');
    await trackEvent({
      action: 'submit_solution',
      feature: 'challenge',
      status: 'start',
      metadata: { codeLength: code.length },
    });
    try {
      const res = await axios.post(`${apiBaseUrl}/submit-challenge/`, {
        challenge_description: challenge,
        student_code: code,
        pedagogy_context: {
          level,
          pedagogicalStyle: 'Feedback explicatif + actionnable',
          aiTone: 'Évaluateur pédagogique précis',
        },
      });
      setEvaluation(res.data.evaluation);
      await trackEvent({
        action: 'submit_solution',
        feature: 'challenge',
        status: 'success',
        metadata: { codeLength: code.length },
      });
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setEvaluation('');
      setError(detail || "Erreur lors de la soumission.");
      await trackEvent({
        action: 'submit_solution',
        feature: 'challenge',
        status: 'error',
        metadata: { codeLength: code.length },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4 rounded-2xl border bg-card">
      <h2 className="text-2xl font-bold">⚔️ Défi Collaboratif</h2>

      <Button
        onClick={generateChallenge}
        disabled={loading}
      >
        {loading ? 'Génération...' : '🎲 Générer un nouveau défi'}
      </Button>

      {error && (
        <div className="rounded-lg border bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {challenge && (
        <div className="p-4 rounded-lg border bg-muted/40 whitespace-pre-wrap mt-4">
          <h3 className="font-semibold text-lg mb-2">Défi :</h3>
          <p>{challenge}</p>
        </div>
      )}

      {challenge && (
        <>
          <Editor
            height="300px"
            defaultLanguage="python"
            value={code}
            onChange={(val) => setCode(val || '')}
            className="mt-4"
          />

          <Button
            onClick={submitSolution}
            variant="secondary"
            className="mt-4"
            disabled={loading || !code}
          >
            {loading ? 'Soumission...' : '✅ Soumettre ma solution'}
          </Button>
        </>
      )}

      {evaluation && (
        <div className="p-4 mt-4 rounded-lg border bg-muted/40 whitespace-pre-wrap">
          <h3 className="font-semibold">📝 Évaluation de IA :</h3>
          <p>{evaluation}</p>
        </div>
      )}

      {loading && (
        <div className="text-muted-foreground font-medium text-sm">
          ⏳ Traitement en cours...
        </div>
      )}
    </div>
  );
}
