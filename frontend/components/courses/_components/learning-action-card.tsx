import { ReactNode } from 'react';

type LearningActionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
};

export default function LearningActionCard({ icon, title, description, action }: LearningActionCardProps) {
  return (
    <article className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <div>{action}</div>
    </article>
  );
}
