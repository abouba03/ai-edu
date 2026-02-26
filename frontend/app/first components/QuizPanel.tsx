'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Question = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

export default function QuizPanel() {
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState('');
  const [level, setLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>('débutant');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQuiz = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${apiBaseUrl}/generate-quiz/`, {
        theme,
        level,
        nb_questions: 3,
        pedagogy_context: {
          level,
          pedagogicalStyle: 'Quiz diagnostique progressif',
          aiTone: 'Coach évaluateur clair',
        },
      });
      setQuestions(res.data.quiz);
      setUserAnswers([]);
      setScore(null);
      setQuizCompleted(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur lors de la génération du quiz.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryTheme = searchParams.get('theme');
    const queryLevel = searchParams.get('level');

    if (queryTheme?.trim()) {
      setTheme(queryTheme);
    }

    if (queryLevel === 'débutant' || queryLevel === 'intermédiaire' || queryLevel === 'avancé') {
      setLevel(queryLevel);
    }
  }, [searchParams]);

  const handleAnswer = (index: number, choice: string) => {
    const updated = [...userAnswers];
    updated[index] = choice;
    setUserAnswers(updated);
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.answer) correct++;
    });
    setScore(correct);
    setQuizCompleted(true);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 rounded-2xl border bg-card">
      <h2 className="text-2xl font-bold">🧪 Quiz interactif</h2>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Ex : boucles for, erreurs d'indentation..."
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'débutant' | 'intermédiaire' | 'avancé')}
          className="border px-3 py-1 rounded"
        >
          <option value="débutant">Débutant</option>
          <option value="intermédiaire">Intermédiaire</option>
          <option value="avancé">Avancé</option>
        </select>

        <button
          onClick={fetchQuiz}
          className="hidden"
        >
          🎯 Générer le quiz
        </button>

        <Button onClick={fetchQuiz} disabled={loading || !theme.trim()}>
          {loading ? 'Génération...' : '🎯 Générer le quiz'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-6 mt-4">
          {questions.map((q, i) => (
            <div key={i} className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <p className="font-semibold">{i + 1}. {q.question}</p>
              {q.choices.map((choice, j) => (
                <label key={j} className="block rounded-md px-2 py-1 hover:bg-accent/50 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${i}`}
                    value={choice}
                    checked={userAnswers[i] === choice}
                    onChange={() => handleAnswer(i, choice)}
                  />{" "}
                  {choice}
                </label>
              ))}
              {quizCompleted && (
                <div className="text-sm mt-2">
                  <p>
                    ✅ Bonne réponse : <strong>{q.answer}</strong>
                  </p>
                  <p className="text-muted-foreground">💡 {q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {!quizCompleted ? (
            <Button
              onClick={handleSubmit}
            >
              ✅ Soumettre mes réponses
            </Button>
          ) : (
            <div className="text-xl font-semibold text-center">
              🎉 Score : {score}/{questions.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
