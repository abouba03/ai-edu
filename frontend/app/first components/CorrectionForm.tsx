"use client"
import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import axios from 'axios';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const Debugger = () => {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');

  const runCode = async () => {
    try {
      const response = await axios.post(`${apiBaseUrl}/execute/`, { code });
      setOutput(response.data.output);
    } catch {
      setOutput('Erreur lors de l\'exécution');
    }
  };

  return (
    <div>
      <h2>Débogueur de Code</h2>
      <MonacoEditor
        height="300px"
        defaultLanguage="python"
        value={code}
        onChange={(value) => setCode(value || '')}
      />
      <button onClick={runCode}>Exécuter</button>
      <pre>{output}</pre>
    </div>
  );
};

export default Debugger;
