'use client';

import { useState } from 'react';
import axios from 'axios';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Props = {
  username: string;
  recentResult: string;
};

export default function MotivationalBox({ username, recentResult }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const getMotivation = async () => {
    setLoading(true);
    const res = await axios.post(`${apiBaseUrl}/motivational-feedback/`, {
      username,
      recent_result: recentResult,
      mood: 'neutre',
    });
    setMessage(res.data.message);
    setLoading(false);
  };

  return (
    <div className="p-4 bg-yellow-100 rounded shadow space-y-2">
      <button
        onClick={getMotivation}
        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
      >
        💬 Obtenir un message motivant
      </button>
      {loading && <p>Chargement...</p>}
      {message && (
        <div className="mt-2 text-yellow-800 font-semibold italic">
          {message}
        </div>
      )}
    </div>
  );
}
