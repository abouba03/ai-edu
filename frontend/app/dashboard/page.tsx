import Link from 'next/link';
import { BarChart3, Brain, Sparkles, Target } from 'lucide-react';

const cards = [
  {
    title: 'Génération assistée',
    description: 'Produire du code Python à partir d’un besoin.',
    href: '/generator',
    icon: Sparkles,
  },
  {
    title: 'Debug interactif',
    description: 'Comprendre les erreurs pas à pas avec guidance IA.',
    href: '/debugger',
    icon: Brain,
  },
  {
    title: 'Évaluation active',
    description: 'Mesurer la progression via quiz et défis.',
    href: '/challenges',
    icon: Target,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-primary font-semibold">Dashboard pédagogique</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Vue d’ensemble de la plateforme</h1>
        <p className="text-muted-foreground mt-2">
          Ton espace central pour piloter la génération, la correction et le suivi des apprentissages.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border bg-card p-5 hover:bg-accent/40 transition-colors space-y-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl border bg-card p-5 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          Conseil: utilise la route <span className="text-foreground font-medium">/api/events/summary</span> pour suivre les KPI pendant les tests utilisateur.
        </p>
      </section>
    </div>
  );
}
