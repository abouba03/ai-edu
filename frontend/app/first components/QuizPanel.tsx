'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';

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
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(detail || 'Erreur lors de la génération du quiz.');
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode théorie</p>
          <h2 className="text-xl font-semibold mt-1">🧪 Quiz interactif</h2>
        </div>
        {score !== null && quizCompleted && (
          <div className="rounded-lg border bg-background px-3 py-2 text-sm font-medium">
            Score: {score}/{questions.length}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,220px,auto] gap-2">
        <input
          type="text"
          placeholder="Ex : boucles for, erreurs d'indentation..."
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'débutant' | 'intermédiaire' | 'avancé')}
          className="border px-3 py-2 rounded-lg bg-background"
        >
          <option value="débutant">Débutant</option>
          <option value="intermédiaire">Intermédiaire</option>
          <option value="avancé">Avancé</option>
        </select>

        <Button onClick={fetchQuiz} disabled={loading || !theme.trim()}>
          <Sparkles className="size-4" /> {loading ? 'Génération...' : 'Générer'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border bg-destructive/10 text-destructive p-3 text-sm">
          {error}
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-3 mt-2">
          {questions.map((q, i) => (
            <div key={i} className="p-3 rounded-xl border bg-muted/20 space-y-2">
              <p className="font-medium text-sm">{i + 1}. {q.question}</p>
              {q.choices.map((choice, j) => (
                <label key={j} className="block rounded-md px-2 py-1 hover:bg-accent/50 cursor-pointer text-sm">
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
                  <p className="text-muted-foreground mt-1">💡 {q.explanation}</p>
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
            <div className="text-lg font-semibold text-center rounded-xl border bg-background p-3">
              🎉 Score : {score}/{questions.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
