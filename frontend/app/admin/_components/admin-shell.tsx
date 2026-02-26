'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Layers3, FolderKanban, BookOpen, Settings2 } from 'lucide-react';

const tabs = [
  { href: '/admin/formations', label: 'Formations', icon: Layers3 },
  { href: '/admin/formules', label: 'Formules', icon: FolderKanban },
  { href: '/admin/cours', label: 'Cours', icon: BookOpen },
  { href: '/admin/formation', label: 'Paramètres globaux', icon: Settings2 },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl lg:text-3xl font-bold">Espace Admin</h1>
        <p className="text-muted-foreground mt-1">Gestion organisée des formations, formules et cours.</p>
      </section>

      <nav className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 transition-colors',
                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'
              )}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
