'use client';

import { Flag } from 'lucide-react';

type CourseSidebarProps = {
  objectives: string[];
};

export default function CourseSidebar({ objectives }: CourseSidebarProps) {
  return (
    <section className="border-2 border-[#1C293C] bg-white p-4 shadow-[3px_3px_0px_0px_#1C293C] space-y-3">
      <h3 className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-2">
        <Flag className="h-3.5 w-3.5" /> Измеримые цели
      </h3>
      <ul className="space-y-2">
        {objectives.slice(0, 3).map((item, i) => (
          <li key={item} className="flex items-start gap-2.5 text-xs font-medium text-[#1C293C]/70 leading-relaxed">
            <span className="border border-[#1C293C]/30 bg-[#FBFBF9] px-1.5 py-0.5 text-[10px] font-black text-[#1C293C] shrink-0 mt-0.5">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
