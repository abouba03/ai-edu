'use client';

import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { trackEvent } from '@/lib/event-tracker';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function InteractiveDebugger() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [level, setLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>('débutant');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [iaResponse, setIaResponse] = useState('');
  const [waitingResponse, setWaitingResponse] = useState(false);

  useEffect(() => {
    const queryCode = searchParams.get('code');
    const queryLevel = searchParams.get('level');

    if (queryCode?.trim()) {
      setCode(queryCode);
    }

    if (queryLevel === 'débutant' || queryLevel === 'intermédiaire' || queryLevel === 'avancé') {
      setLevel(queryLevel);
    }
  }, [searchParams]);

  const handleAnalyze = async () => {
    setWaitingResponse(true);
    setStep(0);
    setSessionId(null);
    await trackEvent({
      action: 'debug_analyze',
      feature: 'interactive_debugger',
      status: 'start',
      metadata: { level, step },
    });
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code,
        level,
        step,
        student_answer: '',
        session_id: null,
        pedagogy_context: {
          level,
          pedagogicalStyle: 'Debug guidé socratique',
          aiTone: 'Coach patient et précis',
          progressPercent: step * 10,
        },
      });
      setIaResponse(res.data.response);
      setSessionId(res.data.session_id ?? null);
      setStep(Number(res.data.step ?? 1));
      setStudentAnswer('');
      setWaitingResponse(false);
      await trackEvent({
        action: 'debug_analyze',
        feature: 'interactive_debugger',
        status: 'success',
        metadata: { level, step },
      });
    } catch {
      setIaResponse("Ошибка при анализе кода.");
      setWaitingResponse(false);
      await trackEvent({
        action: 'debug_analyze',
        feature: 'interactive_debugger',
        status: 'error',
        metadata: { level, step },
      });
    }
  };

  const handleStudentReply = async () => {
    setWaitingResponse(true);
    await trackEvent({
      action: 'debug_reply',
      feature: 'interactive_debugger',
      status: 'start',
      metadata: { level, step: step + 1 },
    });
    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code,
        level,
        step: step + 1,
        student_answer: studentAnswer,
        session_id: sessionId,
        pedagogy_context: {
          level,
          pedagogicalStyle: 'Debug guidé socratique',
          aiTone: 'Coach patient et précis',
          progressPercent: Math.min(95, (step + 1) * 10),
        },
      });
      setIaResponse(res.data.response);
      setSessionId(res.data.session_id ?? sessionId);
      setStep(Number(res.data.step ?? step + 1));
      setStudentAnswer('');
      setWaitingResponse(false);
      await trackEvent({
        action: 'debug_reply',
        feature: 'interactive_debugger',
        status: 'success',
        metadata: { level, step: step + 1 },
      });
    } catch {
      setIaResponse("Ошибка при отправке ответа.");
      setWaitingResponse(false);
      await trackEvent({
        action: 'debug_reply',
        feature: 'interactive_debugger',
        status: 'error',
        metadata: { level, step: step + 1 },
      });
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-4xl mx-auto">
      <div className="rounded-xl border bg-background p-4 space-y-2">
        <h2 className="text-2xl font-bold">🧠 Интерактивный режим отладки</h2>
        <p className="text-sm text-muted-foreground">Постоянная сессия + адаптивное руководство для понимания ошибки перед исправлением.</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-1">Сессия: {sessionId ? sessionId.slice(0, 8) : 'новая'}</span>
          <span className="rounded-full border px-2 py-1">Шаг: {step}</span>
          <span className="rounded-full border px-2 py-1">Уровень: {level}</span>
        </div>
      </div>

      <label className="block text-sm font-medium">Выбрать уровень:</label>
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as 'débutant' | 'intermédiaire' | 'avancé')}
        className="border px-3 py-2 rounded-lg bg-background"
      >
        <option value="débutant">Начинающий</option>
        <option value="intermédiaire">Средний</option>
        <option value="avancé">Продвинутый</option>
      </select>

      <Editor
        height="250px"
        defaultLanguage="python"
        value={code}
        onChange={(val) => setCode(val || '')}
      />

      <Button
        onClick={handleAnalyze}
        disabled={waitingResponse}
      >
        {waitingResponse ? 'Analyse...' : '🔍 Analyser le code'}
      </Button>

      {iaResponse && (
        <div className="bg-muted/40 border p-4 rounded-lg whitespace-pre-wrap text-sm">
          {iaResponse}
        </div>
      )}

      {iaResponse && (
        <div className="space-y-2">
          <label className="block text-sm font-medium mt-4">Ta réponse :</label>
          <input
            type="text"
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            className="w-full border px-3 py-2 rounded-lg bg-background"
            placeholder="Ta réponse à la question de l’IA..."
          />
          <Button
            onClick={handleStudentReply}
            variant="secondary"
            disabled={waitingResponse || !studentAnswer.trim()}
          >
            {waitingResponse ? 'Envoi...' : '✅ Envoyer la réponse'}
          </Button>
        </div>
      )}
    </div>
  );
}
