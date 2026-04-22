'use client';

import type { PlotPayload, PlotSeries } from './types';

type GeneratorPlotPanelProps = {
  plotPayload: PlotPayload | null;
};

function buildPolylinePoints(series: PlotSeries, width: number, height: number): string {
  const points = series.points;
  if (points.length === 0) return '';

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  return points
    .map((p) => {
      const x = ((p.x - minX) / xSpan) * width;
      const y = height - ((p.y - minY) / ySpan) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildPlaceholderPolyline(width: number, height: number): string {
  const points: Array<{ x: number; y: number }> = [];
  const steps = 18;
  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const x = ratio * width;
    const y = height * (0.5 + Math.sin(ratio * Math.PI * 2) * 0.25);
    points.push({ x, y });
  }
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export default function GeneratorPlotPanel({ plotPayload }: GeneratorPlotPanelProps) {
  const width = 720;
  const height = 240;
  const colors = ['#432DD7', '#F97316', '#16A34A', '#0891B2'];
  const hasData = Boolean(plotPayload && plotPayload.series.length > 0);

  if (!hasData) {
    return (
      <div className="space-y-2">
        <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Courbe resultat</p>
          <p className="mt-1 text-[11px] text-[#1C293C]/75">Aucune donnee recue pour le moment.</p>
        </div>

        <div className="border border-[#1C293C]/20 bg-white p-2">
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full min-w-[520px] bg-[#FBFBF9]">
              <line x1="0" y1={height} x2={width} y2={height} stroke="#1C293C" strokeWidth="1.2" />
              <line x1="0" y1="0" x2="0" y2={height} stroke="#1C293C" strokeWidth="1.2" />
              <polyline
                fill="none"
                stroke="#1C293C55"
                strokeDasharray="6 6"
                strokeWidth="2"
                points={buildPlaceholderPolyline(width, height)}
              />
              <text x="12" y="18" fill="#1C293C99" fontSize="12">Apercu du graphe</text>
            </svg>
          </div>
        </div>

        <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2 text-[11px] text-[#1C293C]/80">
          Imprime: {`PLOT_JSON:{"title":"Courbe","x":[0,1,2],"y":[0,1,4]}`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Courbe resultat</p>
        <p className="mt-1 text-xs font-semibold text-[#1C293C]">
          {plotPayload?.title?.trim() || 'Resultat numerique'}
        </p>
        <p className="text-[11px] text-[#1C293C]/70">
          {plotPayload?.xLabel || 'x'} / {plotPayload?.yLabel || 'y'}
        </p>
      </div>

      <div className="border border-[#1C293C]/20 bg-white p-2">
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full min-w-[520px] bg-[#FBFBF9]">
            <line x1="0" y1={height} x2={width} y2={height} stroke="#1C293C" strokeWidth="1.2" />
            <line x1="0" y1="0" x2="0" y2={height} stroke="#1C293C" strokeWidth="1.2" />
            {plotPayload?.series.map((series, index) => (
              <polyline
                key={`${series.name}-${index}`}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="2.5"
                points={buildPolylinePoints(series, width, height)}
              />
            ))}
          </svg>
        </div>
      </div>

      <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2">
        <div className="flex flex-wrap gap-1.5">
          {plotPayload?.series.map((series, index) => (
            <span key={`${series.name}-${index}`} className="inline-flex items-center gap-1 bg-white border border-[#1C293C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1C293C]">
              <span className="inline-block h-2 w-2" style={{ backgroundColor: colors[index % colors.length] }} />
              {series.name} ({series.points.length})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
