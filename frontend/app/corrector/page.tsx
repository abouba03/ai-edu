import { Suspense } from 'react';
import CodeCorrector from '../first components/CodeCorrector';

export default function CorrectorPage() {
  return (
    <div>
      <Suspense fallback={<div className="p-4 text-sm text-[#1C293C]">Chargement du correcteur...</div>}>
        <CodeCorrector />
      </Suspense>
    </div>
  );
}
