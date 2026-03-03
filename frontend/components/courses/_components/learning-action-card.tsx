import { ReactNode } from 'react';

type LearningActionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
};

export default function LearningActionCard({ icon, title, description, action }: LearningActionCardProps) {
  return (
    <article className="rounded-lg border bg-background/70 p-2.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 space-y-0.5">
          <h4 className="font-semibold text-xs leading-tight">{title}</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <div>{action}</div>
    </article>
  );
}
