'use client';

import { useState } from 'react';
import axios from 'axios';

type Question = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

export default function QuizPanel() {
  const [theme, setTheme] = useState('');
  const [level, setLevel] = useState<'débutant' | 'intermédiaire' | 'avancé'>('débutant');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const fetchQuiz = async () => {
    const res = await axios.post('http://localhost:8000/generate-quiz/', {
      theme,
      level,
      nb_questions: 3,
    });
    setQuestions(res.data.quiz);
    setUserAnswers([]);
    setScore(null);
    setQuizCompleted(false);
  };

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
    <div className="max-w-3xl mx-auto p-6 space-y-4">
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
          className="bg-blue-600  px-4 py-2 rounded hover:bg-blue-700"
        >
          🎯 Générer le quiz
        </button>
      </div>

      {questions.length > 0 && (
        <div className="space-y-6 mt-4">
          {questions.map((q, i) => (
            <div key={i} className="p-4 rounded border shadow space-y-2">
              <p className="font-semibold">{i + 1}. {q.question}</p>
              {q.choices.map((choice, j) => (
                <label key={j} className="block">
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
                  <p className="text-gray-600">💡 {q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {!quizCompleted ? (
            <button
              onClick={handleSubmit}
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
            >
              ✅ Soumettre mes réponses
            </button>
          ) : (
            <div className="text-xl font-semibold text-center text-blue-700">
              🎉 Score : {score}/{questions.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
