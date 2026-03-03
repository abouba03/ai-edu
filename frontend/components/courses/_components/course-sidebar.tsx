'use client';

import { Flag } from 'lucide-react';

type CourseSidebarProps = {
  objectives: string[];
};

export default function CourseSidebar({
  objectives,
}: CourseSidebarProps) {
  return (
    <section className="rounded-xl border bg-card p-3 space-y-2">
      <h3 className="font-semibold inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Flag className="h-4 w-4 text-primary" /> Objectifs mesurables
      </h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {objectives.slice(0, 3).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}
