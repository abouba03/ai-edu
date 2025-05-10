'use client';

import React, { useState } from 'react';
import axios from 'axios';

export default function CodeGenerator() {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');

  const handleGenerate = async () => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/generate/`, { prompt });
      setCode(response.data.code);
    } catch {
      setCode("Erreur lors de la génération du code");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">Générateur de Code Python</h2>
      <textarea
        className="w-full p-2 border rounded"
        placeholder="Décrivez votre besoin en code..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      ></textarea>
      <button onClick={handleGenerate} className="mt-2 p-2 bg-blue-500 text-white rounded">
        Générer le Code
      </button>
      <pre className="mt-4 p-2 bg-primary/10 rounded">{code}</pre>
    </div>
  );
}
