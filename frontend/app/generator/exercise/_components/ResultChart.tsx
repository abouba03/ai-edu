'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { EvalTestResult } from './types';

/** Try to parse a Python repr string into a JS number or number array */
function tryParseValue(str: string): number | number[] | null {
  if (!str) return null;
  const s = str.trim();

  // Simple number
  const n = Number(s);
  if (!Number.isNaN(n) && s !== '') return n;

  // Python/JS list: [1, 2, 3] or [1.5, 2.0]
  const listMatch = s.match(/^\[(.+)\]$/);
  if (listMatch) {
    try {
      const safe = s.replace(/'/g, '"');
      const arr = JSON.parse(safe);
      if (Array.isArray(arr) && arr.every((v) => typeof v === 'number')) {
        return arr as number[];
      }
    } catch {
      const parts = listMatch[1].split(',').map((p) => Number(p.trim()));
      if (parts.length > 1 && parts.every((p) => !Number.isNaN(p))) return parts;
    }
  }

  return null;
}

type Props = {
  testResults: EvalTestResult[];
};

export default function ResultChart({ testResults }: Props) {
  if (!testResults || testResults.length === 0) return null;

  // --- Mode 1: all actuals are scalars → Bar chart Expected vs Obtenu ---
  const numericPairs = testResults
    .filter((t) => t.actual !== undefined && t.expected !== undefined)
    .map((t) => {
      const actual = tryParseValue(t.actual!);
      const expected = tryParseValue(t.expected!);
      return { name: t.name ?? 'test', actual, expected };
    })
    .filter(
      (d): d is { name: string; actual: number; expected: number } =>
        typeof d.actual === 'number' && typeof d.expected === 'number',
    );

  if (numericPairs.length >= 2) {
    return (
      <div className="mt-3 border-2 border-[#1C293C] bg-white p-3 shadow-[2px_2px_0px_0px_#1C293C]">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-2">
          График — Ожидалось vs Получено
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={numericPairs} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#1C293C' }}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 9, fill: '#1C293C' }} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                border: '2px solid #1C293C',
                borderRadius: 0,
                fontFamily: 'monospace',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="expected" name="Ожидалось" fill="#432DD7" radius={[2, 2, 0, 0]} />
            <Bar dataKey="actual" name="Получено" fill="#22C55E" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[9px] text-gray-400 mt-1 text-center">
          Синие столбцы = ожидаемые значения · Зеленые столбцы = полученные значения
        </p>
      </div>
    );
  }

  // --- Mode 2: at least one actual is a list → Line chart of returned array ---
  const listResult = testResults
    .map((t) => {
      if (!t.actual) return null;
      const val = tryParseValue(t.actual);
      if (Array.isArray(val) && val.length >= 2) return { name: t.name, data: val };
      return null;
    })
    .find(Boolean);

  if (listResult) {
    const chartData = listResult.data.map((v, i) => ({ index: i, valeur: v }));
    return (
      <div className="mt-3 border-2 border-[#1C293C] bg-white p-3 shadow-[2px_2px_0px_0px_#1C293C]">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1">
          График — {listResult.name ?? 'Результат функции'}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="index" tick={{ fontSize: 9, fill: '#1C293C' }} label={{ value: 'index', position: 'insideBottom', offset: -2, fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9, fill: '#1C293C' }} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                border: '2px solid #1C293C',
                borderRadius: 0,
                fontFamily: 'monospace',
              }}
            />
            <Line
              type="monotone"
              dataKey="valeur"
              stroke="#432DD7"
              dot={{ r: 3, fill: '#432DD7' }}
              strokeWidth={2}
              name="возвращаемое значение"
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[9px] text-gray-400 mt-1 text-center">
          Значения, которые вернула функция в тесте « {listResult.name} »
        </p>
      </div>
    );
  }

  return null;
}
