'use client';

import type { EvaluationJson, PerfPayload, PlotPayload } from './types';
import GeneratorPlotPanel from './GeneratorPlotPanel';

type GeneratorLearningVisualsPanelProps = {
  plotPayload: PlotPayload | null;
  perfPayload: PerfPayload | null;
  latestRuntimeSeconds: number | null;
  evaluationJson: EvaluationJson | null;
};

type ComparePoint = {
  name: string;
  expected: number;
  actual: number;
};

function parseFirstNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;

  const normalized = raw.replace(',', '.');
  const match = normalized.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function extractExpectedActualPairs(evaluationJson: EvaluationJson | null): ComparePoint[] {
  if (!evaluationJson?.test_results?.length) return [];

  return evaluationJson.test_results
    .map((test, index) => {
      const expected = parseFirstNumber(test.expected);
      const actual = parseFirstNumber(test.actual);
      if (expected === null || actual === null) return null;

      return {
        name: test.name?.trim() || `Test ${index + 1}`,
        expected,
        actual,
      };
    })
    .filter((point): point is ComparePoint => point !== null)
    .slice(0, 8);
}

function buildPerfPolyline(perfPayload: PerfPayload, width: number, height: number): string {
  if (!perfPayload.points.length) return '';

  const minN = Math.min(...perfPayload.points.map((p) => p.n));
  const maxN = Math.max(...perfPayload.points.map((p) => p.n));
  const minT = Math.min(...perfPayload.points.map((p) => p.timeMs));
  const maxT = Math.max(...perfPayload.points.map((p) => p.timeMs));

  const nSpan = maxN - minN || 1;
  const tSpan = maxT - minT || 1;

  return perfPayload.points
    .map((p) => {
      const x = ((p.n - minN) / nSpan) * width;
      const y = height - ((p.timeMs - minT) / tSpan) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function passRate(evaluationJson: EvaluationJson | null): number {
  const passed = evaluationJson?.test_summary?.passed ?? 0;
  const total = evaluationJson?.test_summary?.total ?? 0;
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

export default function GeneratorLearningVisualsPanel({
  plotPayload,
  perfPayload,
  latestRuntimeSeconds,
  evaluationJson,
}: GeneratorLearningVisualsPanelProps) {
  const compareData = extractExpectedActualPairs(evaluationJson);
  const tests = evaluationJson?.test_results ?? [];
  const summary = evaluationJson?.test_summary;
  const width = 640;
  const height = 220;
  const rate = passRate(evaluationJson);
  const passed = summary?.passed ?? 0;
  const total = summary?.total ?? 0;

  return (
    <div className="space-y-2.5">
      <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#1C293C]">Visualisations</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <div className="border border-[#1C293C]/15 bg-white px-2 py-1 text-[11px] text-[#1C293C]">Tests: <span className="font-bold">{passed}/{total}</span></div>
          <div className="border border-[#1C293C]/15 bg-white px-2 py-1 text-[11px] text-[#1C293C]">Taux: <span className="font-bold">{rate}%</span></div>
          <div className="border border-[#1C293C]/15 bg-white px-2 py-1 text-[11px] text-[#1C293C]">Points courbe: <span className="font-bold">{plotPayload?.series?.[0]?.points?.length ?? 0}</span></div>
          <div className="border border-[#1C293C]/15 bg-white px-2 py-1 text-[11px] text-[#1C293C]">Bench points: <span className="font-bold">{perfPayload?.points?.length ?? 0}</span></div>
        </div>
      </div>

      <section className="space-y-1.5">
        <GeneratorPlotPanel plotPayload={plotPayload} />
      </section>

      <section className="border border-[#1C293C]/20 bg-white p-2.5 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Attendu vs obtenu</p>
        {compareData.length === 0 ? (
          <p className="text-[11px] text-[#1C293C]/70">Pas de paire numerique detectee.</p>
        ) : (
          <div className="space-y-1.5">
            {compareData.map((item) => {
              const maxVal = Math.max(Math.abs(item.expected), Math.abs(item.actual), 1);
              const expectedWidth = Math.max((Math.abs(item.expected) / maxVal) * 100, 3);
              const actualWidth = Math.max((Math.abs(item.actual) / maxVal) * 100, 3);
              const delta = Math.abs(item.expected - item.actual);
              return (
                <div key={item.name} className="border border-[#1C293C]/15 p-2 bg-[#FBFBF9]">
                  <p className="text-[11px] font-bold text-[#1C293C]">{item.name}</p>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[10px] font-black uppercase text-[#1C293C]/70">Attendu</span>
                      <div className="h-2 flex-1 bg-[#E5E7EB]">
                        <div className="h-2 bg-[#0B6E4F]" style={{ width: `${expectedWidth}%` }} />
                      </div>
                      <span className="w-16 text-right text-[11px] font-semibold text-[#1C293C]">{item.expected}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[10px] font-black uppercase text-[#1C293C]/70">Obtenu</span>
                      <div className="h-2 flex-1 bg-[#E5E7EB]">
                        <div className="h-2 bg-[#432DD7]" style={{ width: `${actualWidth}%` }} />
                      </div>
                      <span className="w-16 text-right text-[11px] font-semibold text-[#1C293C]">{item.actual}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-[#1C293C]/70">Ecart: {delta}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="border border-[#1C293C]/20 bg-white p-2.5 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Performance (n -> temps)</p>

        {perfPayload?.points?.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#1C293C]">{perfPayload.title?.trim() || 'Benchmark'} (ms)</p>
            <div className="w-full overflow-x-auto border border-[#1C293C]/15 bg-[#FBFBF9] p-2">
              <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full min-w-[520px]">
                <line x1="0" y1={height} x2={width} y2={height} stroke="#1C293C" strokeWidth="1.4" />
                <line x1="0" y1="0" x2="0" y2={height} stroke="#1C293C" strokeWidth="1.4" />
                <polyline
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="2.5"
                  points={buildPerfPolyline(perfPayload, width, height)}
                />
              </svg>
            </div>
            <p className="text-[10px] text-[#1C293C]/70">Points: {perfPayload.points.length}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] text-[#1C293C]/70">Pas de courbe de performance detectee.</p>
            {latestRuntimeSeconds !== null && (
              <p className="text-[11px] font-semibold text-[#1C293C]">Derniere execution: {latestRuntimeSeconds.toFixed(3)} s</p>
            )}
            <p className="text-[10px] text-[#1C293C]/70">
              Format: PERF_JSON with points [{`{n,timeMs}`}]
            </p>
          </div>
        )}
      </section>

      <section className="border border-[#1C293C]/20 bg-white p-2.5 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Pass / fail tests</p>

        <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-2">
          <p className="text-xs font-semibold text-[#1C293C]">
            {passed}/{total} passes ({rate}%)
          </p>
          <div className="mt-1 h-2 bg-[#E5E7EB]">
            <div className="h-2 bg-[#0B6E4F]" style={{ width: `${rate}%` }} />
          </div>
        </div>

        {tests.length === 0 ? (
          <p className="text-[11px] text-[#1C293C]/70">Aucun resultat de test pour le moment.</p>
        ) : (
          <div className="space-y-1">
            {tests.map((test, index) => {
              const passed = test.status === 'passed';
              const color = passed ? '#0B6E4F' : '#DC2626';
              return (
                <div key={`${test.name || 'test'}-${index}`} className="flex items-center justify-between border border-[#1C293C]/12 bg-[#FBFBF9] px-2 py-1">
                  <p className="text-[11px] font-semibold text-[#1C293C]">{test.name || `Test ${index + 1}`}</p>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
                    {passed ? 'Pass' : 'Fail'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
