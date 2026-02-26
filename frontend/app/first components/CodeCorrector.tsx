'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CodeCorrector() {
  const [code, setCode] = useState('');
  const [correctedCode, setCorrectedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [hintQuestion, setHintQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCorrect = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${apiBaseUrl}/correct/`, {
        code,
        pedagogy_context: {
          level: 'intermédiaire',
          pedagogicalStyle: 'Correction explicative',
          aiTone: 'Tuteur pédagogique',
        },
      });
      setCorrectedCode(response.data.corrected_code);
      setExplanation(response.data.explanation || '');
      setHintQuestion(response.data.hint_question || '');
    } catch (e: any) {
      const message = e?.response?.data?.detail || "Erreur lors de la correction du code";
      setError(message);
      setCorrectedCode('');
      setExplanation('');
      setHintQuestion('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Correcteur de Code Python</h2>
      <textarea
        className="w-full min-h-40 p-3 border rounded-lg bg-background"
        placeholder="Collez votre code ici..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      ></textarea>

      <div className="flex items-center gap-3">
        <Button onClick={handleCorrect} disabled={loading || !code.trim()}>
          {loading ? 'Correction...' : 'Corriger le Code'}
        </Button>
        {loading && <span className="text-sm text-muted-foreground">Traitement en cours...</span>}
      </div>

      {error && (
        <div className="rounded-lg border bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {correctedCode && (
        <pre className="mt-2 p-4 rounded-lg border bg-muted/40 whitespace-pre-wrap overflow-auto text-sm">
          {correctedCode}
        </pre>
      )}

      {explanation && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="font-semibold mb-1">Explication</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{explanation}</p>
        </div>
      )}

      {hintQuestion && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="font-semibold mb-1">Question de vérification</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{hintQuestion}</p>
        </div>
      )}
    </div>
  );
}
