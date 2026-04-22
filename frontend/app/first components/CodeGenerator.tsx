'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CodeGenerator() {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const queryPrompt = searchParams.get('prompt');
    const queryTheme = searchParams.get('theme');

    if (queryPrompt?.trim()) {
      setPrompt(queryPrompt);
      return;
    }

    if (queryTheme?.trim()) {
      setPrompt(`Explique et illustre en Python le thème suivant: ${queryTheme}`);
    }
  }, [searchParams]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    await trackEvent({
      action: 'generate_code',
      feature: 'code_generator',
      status: 'start',
      metadata: { promptLength: prompt.length },
    });
    try {
      const response = await axios.post(`${apiBaseUrl}/generate/`, {
        prompt,
        pedagogy_context: {
          level: 'intermédiaire',
          pedagogicalStyle: 'Explication orientée pratique',
          aiTone: 'Coach précis',
        },
      });
      setCode(response.data.code);
      await trackEvent({
        action: 'generate_code',
        feature: 'code_generator',
        status: 'success',
        metadata: { promptLength: prompt.length },
      });
    } catch (e: any) {
      const message = e?.response?.data?.detail || "Ошибка при генерации кода";
      setError(message);
      setCode('');
      await trackEvent({
        action: 'generate_code',
        feature: 'code_generator',
        status: 'error',
        metadata: { promptLength: prompt.length },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Генератор Python-кода</h2>
      <textarea
        className="w-full min-h-36 p-3 border rounded-lg bg-background"
        placeholder="Опишите задачу на русском..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      ></textarea>

      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          {loading ? 'Генерирую...' : 'Сгенерировать код'}
        </Button>
        {loading && <span className="text-sm text-muted-foreground">Обрабатываю запрос...</span>}
      </div>

      {error && (
        <div className="rounded-lg border bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {code && (
        <pre className="mt-2 p-4 bg-muted/40 rounded-lg border whitespace-pre-wrap overflow-auto text-sm">
          {code}
        </pre>
      )}
    </div>
  );
}
