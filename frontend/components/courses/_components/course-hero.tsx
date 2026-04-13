'use client';

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
    <section className="border-2 border-[#1C293C] bg-[#FBFBF9] px-4 py-3 shadow-[3px_3px_0px_0px_#1C293C]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
          Progression du cours
        </p>
        <span className="text-xs font-black text-[#1C293C]">{progressPercent}%</span>
      </div>
      <p className="text-[11px] font-semibold text-[#1C293C]/55 mb-2">
        {formationName} · Cours {courseNumber}/{totalCourses} · {courseLevel}
      </p>
      <div className="h-1.5 border border-[#1C293C]/30 bg-white overflow-hidden">
        <div
          className="h-full bg-[#1C293C] transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  );
}
