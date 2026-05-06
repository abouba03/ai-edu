import { Suspense } from 'react';
import TuteurChat from './_components/TuteurChat';

export default function TuteurPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-full overflow-hidden bg-[#FBFBF9]">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="border-2 border-[#1C293C] bg-white p-6 text-center shadow-[4px_4px_0px_0px_#1C293C]">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                ИИ-наставник
              </p>
              <p className="mt-2 text-sm font-black text-[#1C293C]/60">Загрузка...</p>
            </div>
          </div>
        </div>
      }
    >
      <TuteurChat />
    </Suspense>
  );
}
