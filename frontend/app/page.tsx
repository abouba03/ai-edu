import Link from 'next/link';
import { Brain, Code2, Bug, Trophy, ArrowRight } from 'lucide-react';

const modules = [
  {
    title: 'Générateur IA',
    description: 'Transforme un besoin en code Python structuré.',
    href: '/generator',
    icon: Code2,
  },
  {
    title: 'Débogueur interactif',
    description: 'Analyse guidée avec feedback progressif.',
    href: '/debugger',
    icon: Bug,
  },
  {
    title: 'Quiz & Défis',
    description: 'Pratique active avec correction et évaluation.',
    href: '/challenges',
    icon: Trophy,
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 max-w-3xl">
            <p className="text-sm text-primary font-semibold">Plateforme Master — AI Edu Platform</p>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
              Un tuteur IA moderne pour apprendre Python avec confiance.
            </h1>
            <p className="text-muted-foreground text-base lg:text-lg">
              Génération, correction, débogage guidé et défis interactifs dans une expérience unifiée.
            </p>
            <div className="flex gap-3 flex-wrap pt-2">
              <Link href="/generator" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                Commencer maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Ouvrir le dashboard
              </Link>
              <Link href="/admin/formation" className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Panel Admin
              </Link>
            </div>
          </div>
          <div className="size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Brain className="h-8 w-8" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-2xl border bg-card p-5 space-y-3 hover:bg-accent/40 transition-colors"
            >
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-lg">{module.title}</h2>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
