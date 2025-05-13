
import React from 'react';
import MotivationalBox from './components/MotivationalBox';
// import CorrectionForm from './components/CorrectionForm';
// import CodeGenerator from './components/CodeGenerator';
// import CodeCorrector from './components/CodeCorrector';
// import QuizPanel from './components/QuizPanel';

// import InteractiveDebugger from './components/InteractiveDebugger';


export default function Home() {
  return (
    // <main className="p-4">
    //   <h1 className="text-3xl font-bold">Bienvenue sur AI Edu</h1>
    //   <p>Génération et correction de code Python avec GPT-4</p>
    //   <CodeGenerator />
    //   <hr className="my-4" />
    //   <CodeCorrector />
    // </main>
    // <main className="min-h-screen p-6 bg-background text-foreground">
    //   {/* <CorrectionForm /> */}
    //   <InteractiveDebugger />
    // </main>
    <main className="min-h-screen bg-background text-foreground p-6">
      {/* <QuizPanel /> */}
      <MotivationalBox
        username="Aboubacar"
        recentResult="vient de réussir un quiz avec un score de 3/3"
      />
    </main>
  );
}
