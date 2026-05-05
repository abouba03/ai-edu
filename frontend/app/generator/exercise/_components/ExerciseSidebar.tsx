'use client';

import { useState } from 'react';
import { BookOpen, Shield, Lightbulb, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import ResultChart from './ResultChart';
import type {
  ExerciseChallengeJson,
  SidebarTab,
  EvalTestResult,
  ExerciseChallengeTests,
  ExecuteResult,
} from './types';

type Props = {
  challengeJson: ExerciseChallengeJson | null;
  challengeTests: ExerciseChallengeTests | null;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  loading: boolean;
  executing: boolean;
  executeResult: ExecuteResult | null;
  validationMs: number | null;
  performanceSummary: {
    runs: number;
    currentMs: number | null;
    bestMs: number | null;
    averageMs: number | null;
    deltaVsBestMs: number | null;
    deltaVsBestPct: number | null;
  };
};

const TABS: { key: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { key: 'enonce', label: 'Условие', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'contraintes', label: 'Ограничения', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'tests', label: 'Тесты', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'hints', label: 'Подсказки', icon: <Lightbulb className="h-3.5 w-3.5" /> },
];

export default function ExerciseSidebar({
  challengeJson,
  challengeTests,
  activeTab,
  onTabChange,
  loading,
  executing,
  executeResult,
  validationMs,
  performanceSummary,
}: Props) {
  return (
    <aside className="flex flex-col h-full border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] p-2 overflow-hidden">
      <div className="flex-1 border-2 border-[#1C293C] bg-white overflow-hidden flex flex-col">
        <div className="border-b-2 border-[#1C293C] bg-[#FBFBF9] p-1.5 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`inline-flex items-center justify-center gap-1 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] leading-none transition-all ${
                  activeTab === tab.key
                    ? 'border-[#1C293C] bg-[#432DD7] text-white shadow-[1px_1px_0px_0px_#1C293C]'
                    : 'border-[#1C293C]/25 bg-white text-[#1C293C]/70 hover:bg-[#F5F5F0]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <LoadingSkeleton />
          ) : !challengeJson ? (
            <EmptyState />
          ) : (
            <>
              {activeTab === 'enonce' && <EnonceTab challengeJson={challengeJson} />}
              {activeTab === 'contraintes' && <ContraintesTab challengeJson={challengeJson} />}
              {activeTab === 'tests' && (
                <TestsTab
                  challengeTests={challengeTests}
                  executing={executing}
                  executeResult={executeResult}
                  validationMs={validationMs}
                  performanceSummary={performanceSummary}
                />
              )}
              {activeTab === 'hints' && <HintsTab challengeJson={challengeJson} />}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function TestsTab({
  challengeTests,
  executing,
  executeResult,
  validationMs,
  performanceSummary,
}: {
  challengeTests: ExerciseChallengeTests | null;
  executing: boolean;
  executeResult: ExecuteResult | null;
  validationMs: number | null;
  performanceSummary: {
    runs: number;
    currentMs: number | null;
    bestMs: number | null;
    averageMs: number | null;
    deltaVsBestMs: number | null;
    deltaVsBestPct: number | null;
  };
}) {
  type CompactTestRow = {
    name?: string;
    status?: 'passed' | 'failed';
    args_literal?: string;
    expected?: string;
    actual?: string;
    error?: string;
  };

  const testCases = challengeTests?.test_cases ?? [];
  const runSummary = executeResult?.evaluationJson?.test_summary;
  const runResults = executeResult?.evaluationJson?.test_results ?? [];
  const compactResults: CompactTestRow[] = runResults.length > 0
    ? runResults.map((test) => ({
        name: typeof test.name === 'string' ? test.name : undefined,
        status: test.status === 'passed' || test.status === 'failed' ? test.status : undefined,
        expected: typeof test.expected === 'string' ? test.expected : undefined,
        actual: typeof test.actual === 'string' ? test.actual : undefined,
        error: typeof test.error === 'string' ? test.error : undefined,
      }))
    : testCases.map((test) => ({
        name: test.name,
        args_literal: test.args_literal,
        expected: test.expected_literal,
      }));
  const isSuccess = executeResult?.passed === true;
  const cardTone = executeResult
    ? (isSuccess ? 'bg-green-50 border-green-700' : 'bg-red-50 border-red-700')
    : 'bg-white border-[#1C293C]';
  const [subTab, setSubTab] = useState<'details' | 'stats' | 'graph'>('details');
  const passedCount = runSummary?.passed ?? 0;
  const failedCount = runSummary?.failed ?? 0;
  const totalCount = runSummary?.total ?? 0;
  const toRuStatus = (status?: 'passed' | 'failed') => {
    if (status === 'passed') return 'пройден';
    if (status === 'failed') return 'ошибка';
    return '';
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Тесты</p>

      <div className={`border-2 p-2 ${cardTone}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-black text-[#1C293C]">
            {challengeTests?.function_name
              ? `Функция: ${challengeTests.function_name}`
              : 'Проверка тестов'}
          </p>
          {executeResult && (
            <span className={`text-[10px] font-black uppercase ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
              {isSuccess ? 'успех' : 'ошибка'}
            </span>
          )}
        </div>

        {executing && (
          <div className="inline-flex items-center gap-1.5 text-xs text-[#1C293C] mb-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Выполнение...
          </div>
        )}

        {!executing && runSummary && (
          <p className="text-[11px] text-[#1C293C] mb-1">
            ✓ {runSummary.passed ?? 0} | ✗ {runSummary.failed ?? 0} | Всего {runSummary.total ?? 0}
          </p>
        )}

        {/* Temps d'exécution de l'algorithme (mesuré côté Python) */}
        {!executing && runSummary?.exec_time_ms != null && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 border border-[#1C293C]/30 bg-[#FBFBF9] px-2 py-0.5 text-[10px] font-mono font-bold text-[#1C293C]">
              ⏱ алгоритм: {runSummary.exec_time_ms < 1 ? `${(runSummary.exec_time_ms * 1000).toFixed(0)} µs` : `${runSummary.exec_time_ms.toFixed(2)} ms`}
            </span>
            {validationMs != null && isSuccess && (
              <span className="inline-flex items-center gap-1 border border-[#22C55E] bg-green-50 px-2 py-0.5 text-[10px] font-mono font-bold text-green-700">
                🏁 решено за {validationMs < 60000 ? `${(validationMs / 1000).toFixed(1)}с` : `${Math.floor(validationMs / 60000)}м${Math.round((validationMs % 60000) / 1000)}с`}
              </span>
            )}
          </div>
        )}

        {!executing && performanceSummary.runs > 0 && (
          <div className="mb-2 border border-[#1C293C]/20 bg-[#FBFBF9] p-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1">
              Сравнение алгоритмов
            </p>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-[#1C293C]">
              <span>запуски: {performanceSummary.runs}</span>
              <span>текущий: {performanceSummary.currentMs != null ? `${performanceSummary.currentMs.toFixed(3)} ms` : '-'}</span>
              <span>лучший: {performanceSummary.bestMs != null ? `${performanceSummary.bestMs.toFixed(3)} ms` : '-'}</span>
              <span>средний: {performanceSummary.averageMs != null ? `${performanceSummary.averageMs.toFixed(3)} ms` : '-'}</span>
            </div>
            {performanceSummary.deltaVsBestMs != null && performanceSummary.deltaVsBestPct != null && (
              <p className={`text-[10px] font-bold mt-1 ${performanceSummary.deltaVsBestMs <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {performanceSummary.deltaVsBestMs <= 0 ? 'Улучшение' : 'Хуже'} относительно лучшего: {Math.abs(performanceSummary.deltaVsBestMs).toFixed(3)} ms ({Math.abs(performanceSummary.deltaVsBestPct).toFixed(1)}%)
              </p>
            )}
          </div>
        )}

        {!executing && !executeResult && (
          <p className="text-xs text-gray-500 mb-2">Нажми «Запустить», чтобы увидеть результат.</p>
        )}

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {[
            { key: 'details', label: 'Детали' },
            { key: 'stats', label: 'Статистика' },
            { key: 'graph', label: 'График' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key as 'details' | 'stats' | 'graph')}
              className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                subTab === tab.key
                  ? 'border-[#1C293C] bg-[#432DD7] text-white'
                  : 'border-[#1C293C]/20 bg-white text-[#1C293C]/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {subTab === 'details' && (
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {compactResults.map((test, index) => {
              const testStatus = test.status;
              const itemTone = testStatus === 'passed'
                ? 'bg-green-100 border-green-700'
                : testStatus === 'failed'
                  ? 'bg-red-100 border-red-700'
                  : 'bg-white border-[#1C293C]';

              return (
                <div key={`${test.name ?? 'test'}-${index}`} className={`border p-1.5 text-[11px] ${itemTone}`}>
                  <p className="font-mono font-bold text-[#1C293C]">
                    {test.name ?? `Test ${index + 1}`}
                    {testStatus ? ` - ${toRuStatus(testStatus)}` : ''}
                  </p>
                  {'args_literal' in test && test.args_literal && (
                    <p className="font-mono text-[#1C293C] break-all">аргументы: {String(test.args_literal)}</p>
                  )}
                  {test.expected && <p className="font-mono text-[#1C293C] break-all">ожидалось: {test.expected}</p>}
                  {test.actual && <p className="font-mono text-[#1C293C] break-all">получено: {test.actual}</p>}
                  {test.error && <p className="font-mono text-red-700 break-all">ошибка: {test.error}</p>}
                </div>
              );
            })}
            {compactResults.length === 0 && (
              <p className="text-xs text-gray-500 italic">Нет тестов для отображения.</p>
            )}
          </div>
        )}

        {subTab === 'stats' && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1">
              <div className="border border-[#22C55E]/40 bg-green-50 p-1.5 text-center">
                <p className="text-[10px] font-black text-[#22C55E]">ПРОЙДЕНО</p>
                <p className="text-sm font-mono font-bold text-[#1C293C]">{passedCount}</p>
              </div>
              <div className="border border-[#DC2626]/40 bg-red-50 p-1.5 text-center">
                <p className="text-[10px] font-black text-[#DC2626]">ПРОВАЛ</p>
                <p className="text-sm font-mono font-bold text-[#1C293C]">{failedCount}</p>
              </div>
              <div className="border border-[#1C293C]/20 bg-white p-1.5 text-center">
                <p className="text-[10px] font-black text-[#1C293C]/70">ВСЕГО</p>
                <p className="text-sm font-mono font-bold text-[#1C293C]">{totalCount}</p>
              </div>
            </div>

            <div className="border border-[#1C293C]/20 bg-[#FBFBF9] p-1.5">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1">
                Сравнение алгоритмов
              </p>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-[#1C293C]">
                <span>запуски: {performanceSummary.runs}</span>
                <span>текущий: {performanceSummary.currentMs != null ? `${performanceSummary.currentMs.toFixed(3)} ms` : '-'}</span>
                <span>лучший: {performanceSummary.bestMs != null ? `${performanceSummary.bestMs.toFixed(3)} ms` : '-'}</span>
                <span>средний: {performanceSummary.averageMs != null ? `${performanceSummary.averageMs.toFixed(3)} ms` : '-'}</span>
              </div>
              {performanceSummary.deltaVsBestMs != null && performanceSummary.deltaVsBestPct != null && (
                <p className={`text-[10px] font-bold mt-1 ${performanceSummary.deltaVsBestMs <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {performanceSummary.deltaVsBestMs <= 0 ? 'Улучшение' : 'Хуже'} относительно лучшего: {Math.abs(performanceSummary.deltaVsBestMs).toFixed(3)} ms ({Math.abs(performanceSummary.deltaVsBestPct).toFixed(1)}%)
                </p>
              )}
            </div>
          </div>
        )}

        {subTab === 'graph' && (
          <div>
            {!executing && runResults.length > 0 ? (
              <ResultChart testResults={runResults} />
            ) : (
              <p className="text-xs text-gray-500 italic">Сначала запусти тесты, чтобы увидеть график.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EnonceTab({ challengeJson }: { challengeJson: ExerciseChallengeJson }) {
  return (
    <div className="space-y-2">
      <div className="border-2 border-[#1C293C] bg-[#FBFBF9] p-2.5 shadow-[1px_1px_0px_0px_#1C293C]">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] inline-flex items-center gap-1.5 mb-1">
          <Sparkles className="h-3.5 w-3.5" /> Задача
        </p>
        <p className="text-[12px] text-[#1C293C] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-1">
          {challengeJson.enonce}
        </p>
      </div>

      <div className="border-2 border-[#1C293C]/30 bg-white p-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] mb-1.5">Что должен делать код</p>
        <p className="text-[11px] text-[#1C293C]/80 leading-relaxed">
          Внимательно прочитай условие, затем проверь во вкладке «Тесты», что все ожидаемые случаи проходят перед отправкой.
        </p>
      </div>

      {challengeJson.exemple && (
        <div className="border-2 border-[#1C293C] overflow-hidden">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] px-2.5 py-1.5 bg-[#FBFBF9] border-b-2 border-[#1C293C]">Пример</p>
          <pre className="bg-[#1C293C] text-[#FDC800] text-[11px] p-2 overflow-auto font-mono leading-snug max-h-36">
            {challengeJson.exemple}
          </pre>
        </div>
      )}
    </div>
  );
}

function ContraintesTab({ challengeJson }: { challengeJson: ExerciseChallengeJson }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Ограничения</p>
      {challengeJson.contraintes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Ограничения не указаны.</p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {challengeJson.contraintes.map((c, i) => (
            <li key={i} className="flex gap-2 items-start text-[12px] text-[#1C293C] border border-[#1C293C]/25 bg-white p-1.5 leading-snug">
              <span className="mt-0.5 text-[#432DD7] font-black shrink-0">{i + 1}</span>
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HintsTab({ challengeJson }: { challengeJson: ExerciseChallengeJson }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Подсказки по шагам</p>
      {challengeJson.hints.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Подсказок пока нет.</p>
      ) : (
        challengeJson.hints.map((hint, i) => (
          <div
            key={i}
            className="border-2 border-[#1C293C] p-2.5 bg-white shadow-[2px_2px_0px_0px_#1C293C]"
          >
            <p className="text-[10px] font-black text-[#432DD7] uppercase mb-1">Подсказка {i + 1}</p>
            <p className="text-sm text-[#1C293C] leading-relaxed">{hint}</p>
          </div>
        ))
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="h-4 w-full bg-gray-200 rounded" />
      <div className="h-4 w-5/6 bg-gray-200 rounded" />
      <div className="h-4 w-4/6 bg-gray-200 rounded" />
      <div className="h-12 w-full bg-gray-200 rounded mt-4" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
      <BookOpen className="h-8 w-8 text-gray-300" />
      <p className="text-sm text-gray-400">Здесь появится условие задачи.</p>
    </div>
  );
}
