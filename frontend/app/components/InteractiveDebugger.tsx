'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';

export default function InteractiveDebugger() {
  const [code, setCode] = useState('');
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>('débutant');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [iaResponse, setIaResponse] = useState('');
  const [waitingResponse, setWaitingResponse] = useState(false);

  const handleAnalyze = async () => {
    setWaitingResponse(true);
    try {
      const res = await axios.post('http://localhost:8000/interactive-debug/', {
        code,
        level,
        step,
        student_answer: '',
      });
      setIaResponse(res.data.response);
      setStudentAnswer('');
      setWaitingResponse(false);
    } catch {
      setIaResponse("Erreur lors de l'analyse.");
      setWaitingResponse(false);
    }
  };

  const handleStudentReply = async () => {
    setWaitingResponse(true);
    try {
      const res = await axios.post('http://localhost:8000/interactive-debug/', {
        code,
        level,
        step: step + 1,
        student_answer: studentAnswer,
      });
      setIaResponse(res.data.response);
      setStep((prev) => prev + 1);
      setStudentAnswer('');
      setWaitingResponse(false);
    } catch {
      setIaResponse("Erreur lors de l'envoi de la réponse.");
      setWaitingResponse(false);
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold">🧠 Mode Débogage Interactif</h2>

      <label className="block text-sm font-medium">Choisir le niveau :</label>
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as 'débutant' | 'intermédiaire' | 'avancé')}
        className="border px-3 py-1 rounded"
      >
        <option value="débutant">Débutant</option>
        <option value="intermédiaire">Intermédiaire</option>
        <option value="avancé">Avancé</option>
      </select>

      <Editor
        height="250px"
        defaultLanguage="python"
        value={code}
        onChange={(val) => setCode(val || '')}
      />

      <button
        onClick={handleAnalyze}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        disabled={waitingResponse}
      >
        🔍 Analyser le code
      </button>

      {iaResponse && (
        <div className="bg-gray-900 text-green-400 p-4 rounded shadow whitespace-pre-wrap">
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
            className="w-full border px-3 py-2 rounded"
            placeholder="Ta réponse à la question de l’IA..."
          />
          <button
            onClick={handleStudentReply}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            disabled={waitingResponse}
          >
            ✅ Envoyer la réponse
          </button>
        </div>
      )}
    </div>
  );
}
