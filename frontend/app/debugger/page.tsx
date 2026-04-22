import { Suspense } from 'react';
import InteractiveDebugger from '../first components/InteractiveDebugger';

export default function DebuggerPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Модуль с поддержкой ИИ</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Интерактивный отладчик</h1>
        <p className="text-muted-foreground mt-2">Анализируй свой код, отвечай на вопросы ИИ и продвигайся шаг за шагом.</p>
      </section>
      <section className="rounded-2xl border bg-card p-2">
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement du debugger...</div>}>
          <InteractiveDebugger />
        </Suspense>
      </section>
    </div>
  );
}
