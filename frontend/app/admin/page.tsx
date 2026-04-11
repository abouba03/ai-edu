import Link from 'next/link';
import prisma from '@/lib/prisma';
import { loadEntityList, type FormuleItem } from '@/lib/admin-entity-store';
import { BookOpen, Code2, FolderKanban, Layers3, Settings2, ArrowRight } from 'lucide-react';

async function countTable(tableName: 'Formation' | 'Course' | 'Challenge') {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count FROM "${tableName}"`
  );
  return Number(rows?.[0]?.count ?? 0);
}

const actions = [
  {
    href: '/admin/formations',
    title: 'Formations',
    description: 'Créer et organiser les parcours de formation.',
    icon: Layers3,
  },
  {
    href: '/admin/formules',
    title: 'Formules',
    description: 'Gérer les offres, prix et options pédagogiques.',
    icon: FolderKanban,
  },
  {
    href: '/admin/cours',
    title: 'Cours',
    description: 'Superviser le catalogue des cours publiés.',
    icon: BookOpen,
  },
  {
    href: '/admin/challenge',
    title: 'Exercices',
    description: 'Construire et publier les exercices théoriques et code.',
    icon: Code2,
  },
  {
    href: '/admin/formation',
    title: 'Paramètres globaux',
    description: 'Piloter les règles générales de la plateforme.',
    icon: Settings2,
  },
];

export default async function AdminIndexPage() {
  const [formationsCount, formules, coursesCount, challengesCount] = await Promise.all([
    countTable('Formation'),
    loadEntityList<FormuleItem>('formules'),
    countTable('Course'),
    countTable('Challenge'),
  ]);
  const formulesCount = formules.length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-6 lg:p-7">
        <p className="text-xs uppercase tracking-wide text-primary font-semibold">Administration</p>
        <h1 className="text-2xl lg:text-3xl font-bold mt-2">Centre de pilotage</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Choisis une action pour ouvrir son espace dédié. Chaque module admin fonctionne sur une page séparée, sans interface en onglets.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Formations</p>
          <p className="text-2xl font-semibold mt-1">{formationsCount}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Formules</p>
          <p className="text-2xl font-semibold mt-1">{formulesCount}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Cours</p>
          <p className="text-2xl font-semibold mt-1">{coursesCount}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Exercices</p>
          <p className="text-2xl font-semibold mt-1">{challengesCount}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-2xl border bg-card p-5 hover:bg-accent/40 transition-colors"
            >
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold mt-4">{action.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
              <p className="text-sm font-medium mt-4 inline-flex items-center gap-1 text-primary">
                Ouvrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
