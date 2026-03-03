'use client';

import { CircleHelp } from 'lucide-react';

type CourseHeroProps = {
  formationName: string;
  courseNumber: number;
  totalCourses: number;
  courseLevel: string;
  progressPercent: number;
};

export default function CourseHero({
  formationName,
  courseNumber,
  totalCourses,
  courseLevel,
  progressPercent,
}: CourseHeroProps) {
  return (
    <section className="rounded-xl border bg-card/60 p-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
            Progression du cours
            <span title="Suivi global de ton avancement sur ce cours.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <span className="text-[11px] font-medium text-primary">{progressPercent}% complété</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formationName} • Cours {courseNumber}/{totalCourses} • {courseLevel}
        </p>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </section>
  );
}
