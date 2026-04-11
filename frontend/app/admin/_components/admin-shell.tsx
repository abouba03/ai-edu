'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Layers3, FolderKanban, BookOpen, Settings2, Code2 } from 'lucide-react';

const tabs = [
  { href: '/admin', label: 'Accueil admin', icon: Settings2 },
  { href: '/admin/formations', label: 'Formations', icon: Layers3 },
  { href: '/admin/formules', label: 'Formules', icon: FolderKanban },
  { href: '/admin/cours', label: 'Cours', icon: BookOpen },
  { href: '/admin/challenge', label: 'Exercices', icon: Code2 },
  { href: '/admin/formation', label: 'Paramètres globaux', icon: Settings2 },
];

export default function AdminShell({
  children,
  showActions = true,
}: {
  children: React.ReactNode;
  showActions?: boolean;
}) {
  return <AdminShellLayout showActions={showActions}>{children}</AdminShellLayout>;
}

export function AdminShellLayout({
  children,
  showActions = true,
}: {
  children: React.ReactNode;
  showActions?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl lg:text-3xl font-bold">Espace Admin</h1>
        <p className="text-muted-foreground mt-1">Navigation par pages dédiées: choisis une action et ouvre son module.</p>
      </section>

      {showActions && (
        <nav className="rounded-2xl border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground px-1 pb-2">Actions admin</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm inline-flex items-center gap-2 transition-colors',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                )}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </Link>
            );
          })}
          </div>
        </nav>
      )}

      {children}
    </div>
  );
}
