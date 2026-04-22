import { Suspense } from 'react';
import TuteurChat from './_components/TuteurChat';

export default function TuteurPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1240px] p-4">
          <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-6 text-center shadow-[4px_4px_0px_0px_#1C293C]">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
              ИИ-наставник
            </p>
            <p className="mt-2 text-sm font-black text-[#1C293C]/60">Загрузка...</p>
          </div>
        </div>
      }
    >
      <TuteurChat />
    </Suspense>
  );
}
