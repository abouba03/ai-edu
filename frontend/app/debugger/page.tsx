import InteractiveDebugger from '../first components/InteractiveDebugger';

export default function DebuggerPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Module guidé</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Débogueur Interactif</h1>
        <p className="text-muted-foreground mt-2">Analyse ton code, réponds aux questions de l’IA et progresse étape par étape.</p>
      </section>
      <section className="rounded-2xl border bg-card p-2">
        <InteractiveDebugger />
      </section>
    </div>
  );
}
