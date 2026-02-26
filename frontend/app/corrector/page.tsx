import CodeCorrector from '../first components/CodeCorrector';

export default function CorrectorPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Correction intelligente</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Correcteur Python</h1>
        <p className="text-muted-foreground mt-2">
          Soumets ton code, obtiens une correction et une explication pédagogique.
        </p>
      </section>

      <section className="rounded-2xl border bg-card p-2">
        <CodeCorrector />
      </section>
    </div>
  );
}
