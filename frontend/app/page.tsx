import React from 'react';
import CodeGenerator from './components/CodeGenerator';
import CodeCorrector from './components/CodeCorrector';

export default function Home() {
  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold">Bienvenue sur AI Edu</h1>
      <p>Génération et correction de code Python avec GPT-4</p>
      <CodeGenerator />
      <hr className="my-4" />
      <CodeCorrector />
    </main>
  );
}
