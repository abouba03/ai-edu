import ChallengeDuel from '../first components/ChallengeDuel';
import QuizPanel from '../first components/QuizPanel';

export default function ChallengesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Évaluation active</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Challenges & Quiz</h1>
        <p className="text-muted-foreground mt-2">Combine défis pratiques et quiz intelligents pour valider la progression.</p>
      </section>

      <section className="rounded-2xl border bg-card p-2">
        <ChallengeDuel />
      </section>

      <section className="rounded-2xl border bg-card p-2">
        <QuizPanel />
      </section>
    </div>
  );
}
