'use client';

import React, { useState } from 'react';
import axios from 'axios';

export default function CodeCorrector() {
  const [code, setCode] = useState('');
  const [correctedCode, setCorrectedCode] = useState('');

  const handleCorrect = async () => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/correct/`, { code });
      setCorrectedCode(response.data.corrected_code);
    } catch {
      setCorrectedCode("Erreur lors de la correction du code");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">Correcteur de Code Python</h2>
      <textarea
        className="w-full p-2 border rounded"
        placeholder="Collez votre code ici..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      ></textarea>
      <button onClick={handleCorrect} className="mt-2 p-2 bg-green-500 text-white rounded">
        Corriger le Code
      </button>
      <pre className="mt-4 p-2  rounded">{correctedCode}</pre>
    </div>
  );
}
