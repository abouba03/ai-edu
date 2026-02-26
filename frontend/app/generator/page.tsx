import CodeGenerator from '../first components/CodeGenerator';

export default function GeneratorPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Module IA</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Générateur de Code Python</h1>
        <p className="text-muted-foreground mt-2">Décris ton besoin en langage naturel, puis récupère un code structuré.</p>
      </section>
      <section className="rounded-2xl border bg-card p-2">
        <CodeGenerator />
      </section>
    </div>
  );
}
