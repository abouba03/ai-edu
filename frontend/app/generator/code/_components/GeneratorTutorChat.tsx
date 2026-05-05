'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Code2, Loader2, RotateCcw, Send, Volume2, VolumeX, Zap } from 'lucide-react';
import type { ConsoleLine } from './types';

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

type TutorMode = 'coach' | 'socratique' | 'creatif';

type GeneratorTutorChatProps = {
  active: boolean;
  challengeDescription: string;
  enonceText: string;
  solutionCode: string;
  consoleLines?: ConsoleLine[];
  level: 'debutant' | 'intermediaire' | 'avance';
  onApplyToEditor: (code: string, mode: 'replace' | 'append') => void;
};

const apiBaseUrl = '/api/generator/code';
const CHAT_TIMEOUT_PRIMARY_MS = 30000;
const CHAT_TIMEOUT_FALLBACK_MS = 4500;

const MODE_CONFIG: Record<TutorMode, { label: string; subtitle: string; color: string; quickReplies: string[] }> = {
  coach: {
    label: 'Коуч',
    color: '#432DD7',
    subtitle: 'Прямые объяснения и план действий',
    quickReplies: [
      'Объясни, что делает этот код',
      'Как улучшить читаемость этого кода?',
    ],
  },
  socratique: {
    label: 'Сократический',
    color: '#0B6E4F',
    subtitle: 'Наводящие вопросы для самостоятельного мышления',
    quickReplies: [
      'Почему здесь нужен именно такой подход?',
      'Какая концепция Python здесь используется?',
    ],
  },
  creatif: {
    label: 'Творческий',
    color: '#D97706',
    subtitle: 'Аналогии и мини-задачи для запоминания',
    quickReplies: [
      'Объясни этот код на аналогии из жизни',
      'Дай похожее задание для практики',
    ],
  },
};

const CODE_ACTIONS = [
  { label: 'Анализ кода', icon: '🔍', prompt: 'Проанализируй мой текущий Python-код. Найди сильные стороны, потенциальные ошибки и предложи конкретные улучшения для редактора.' },
  { label: 'Исправить ошибки', icon: '🔧', prompt: 'Исправь все ошибки в моем коде и дай полный исправленный код в Python-блоке, чтобы я мог сразу применить его в редакторе.' },
  { label: 'Объяснить код', icon: '📖', prompt: 'Объясни мой код построчно, чтобы я понял каждую часть.' },
  { label: 'Оптимизировать', icon: '⚡', prompt: 'Оптимизируй мой Python-код и дай улучшенную, более читаемую версию в Python-блоке для применения в редакторе.' },
  { label: 'Добавить комментарии', icon: '💬', prompt: 'Добавь учебные комментарии в мой код и верни версию с комментариями в Python-блоке.' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:\w*\n)?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const code = (match[1] || '').trim();
    if (code) blocks.push(code);
  }
  return blocks;
}

function MessageContent({
  text,
  onApplyToEditor,
}: {
  text: string;
  onApplyToEditor?: (code: string, mode: 'replace' | 'append') => void;
}) {
  const segments = text.split(/(```(?:\w*\n)?[\s\S]*?```)/g);

  // Render a line of prose with inline **bold** and `code` spans
  function renderInline(raw: string): React.ReactNode {
    const parts = raw.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-[#F0EDFF] px-1 py-0.5 font-mono text-[11px] text-[#432DD7]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-[#1C293C]">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="space-y-1.5 text-[12px] leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.startsWith('```')) {
          const match = segment.match(/```(\w*)\n?([\s\S]*?)```/);
          const lang = match?.[1] ?? 'python';
          const codeContent = match?.[2]?.trim() ?? segment.slice(3, -3).trim();

          return (
            <div key={index} className="overflow-hidden border border-[#1C293C]/20">
              <div className="bg-[#1C293C] px-3 py-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#FDC800]">
                  {lang}
                </span>
              </div>
              <pre className="overflow-x-auto bg-[#0d1117] px-3 py-2.5 text-[12px] font-mono whitespace-pre text-[#e6edf3]">
                {codeContent}
              </pre>
              {onApplyToEditor && (
                <div className="flex items-center gap-2 border-t border-[#1C293C]/20 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onApplyToEditor(codeContent, 'replace')}
                    className="border border-[#1C293C]/30 px-2 py-1 text-[10px] font-bold text-[#1C293C] hover:bg-[#FDC800]"
                  >
                    Заменить в редакторе
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyToEditor(codeContent, 'append')}
                    className="border border-[#1C293C]/30 px-2 py-1 text-[10px] font-bold text-[#1C293C] hover:bg-[#FDC800]"
                  >
                    Добавить в редактор
                  </button>
                </div>
              )}
            </div>
          );
        }

        const normalized = segment
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (!normalized) return null;

        const lines = normalized.split('\n');

        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={`${index}-${lineIndex}`} className="h-1" />;
              }

              // Numbered list: "1. text" or "Erreur 1 : text"
              const numbered = trimmed.match(/^(\d+)[\.\):]\s+(.*)$/) ||
                               trimmed.match(/^(Erreur|Etape|Etape)\s+(\d+)\s*[:\-]\s*(.*)$/i);
              if (numbered) {
                const label = numbered[1];
                const rest = numbered[2] ?? numbered[3] ?? '';
                return (
                  <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C]">
                    <strong className="font-bold text-[#432DD7]">{label}.</strong>{' '}
                    {renderInline(rest)}
                  </p>
                );
              }

              // Dashed / bullet list
              const dashed = trimmed.match(/^[-•→]\s+(.*)$/);
              if (dashed) {
                return (
                  <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C] flex gap-1.5">
                    <span className="font-bold text-[#432DD7] shrink-0">–</span>
                    <span>{renderInline(dashed[1])}</span>
                  </p>
                );
              }

              // Section header: line ending with ':' and no inline code
              if (trimmed.endsWith(':') && !trimmed.includes('`') && trimmed.length < 60) {
                return (
                  <p key={`${index}-${lineIndex}`} className="text-[11px] font-black uppercase tracking-widest text-[#432DD7] pt-1">
                    {trimmed.slice(0, -1)}
                  </p>
                );
              }

              return (
                <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C]">
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="inline-block h-2 w-2 animate-bounce bg-[#432DD7]"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function GeneratorTutorChat({
  active,
  challengeDescription,
  enonceText,
  solutionCode,
  consoleLines = [],
  level,
  onApplyToEditor,
}: GeneratorTutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [activeTutorMode, setActiveTutorMode] = useState<TutorMode>('coach');
  const endRef = useRef<HTMLDivElement>(null);
  const initKeyRef = useRef<string>('');

  // Derive last terminal output from consoleLines
  const { consoleOutput, hasErrors } = useMemo(() => {
    const relevant = consoleLines.filter((l) => l.kind === 'stdout' || l.kind === 'stderr');
    const output = relevant.map((l) => l.text).join('').trim().slice(0, 1200);
    const errors = consoleLines.some((l) => l.kind === 'stderr' && l.text.trim().length > 0);
    return { consoleOutput: output, hasErrors: errors };
  }, [consoleLines]);

  // Keep context stable to avoid re-initializing chat at each code keystroke.
  const contextKey = useMemo(
    () => `${enonceText}\n---\n${solutionCode.slice(0, 2000)}`,
    [enonceText, solutionCode],
  );
  const hasContext = Boolean(enonceText.trim() || solutionCode.trim());
  const lastAiMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === 'ai' && msg.text !== '__typing__') ?? null,
    [messages],
  );
  const lastAssistantCode = useMemo(() => {
    if (!lastAiMessage) return '';
    const blocks = extractCodeBlocks(lastAiMessage.text);
    return blocks.length > 0 ? blocks[blocks.length - 1] : '';
  }, [lastAiMessage]);

  function extractChatErrorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }

      if (err.code === 'ECONNABORTED') {
        return 'Наставник отвечает слишком долго. Попробуй снова через несколько секунд.';
      }

      if (!err.response) {
        return 'API чата недоступен. Проверь маршруты Next /api/generator/code.';
      }
    }
    return 'Ошибка соединения. Сейчас не удается связаться с наставником.';
  }

  async function postInteractiveDebug(payload: Record<string, unknown>) {
    return axios.post(`${apiBaseUrl}/interactive-debug`, payload, { timeout: CHAT_TIMEOUT_PRIMARY_MS });
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!active || !hasContext) return;
    if (initKeyRef.current === contextKey) return;

    initKeyRef.current = contextKey;
    setMessages([]);
    setSessionId(null);
    setStep(0);
    // No automatic assistant greeting: the learner starts the conversation.
  }, [active, contextKey, hasContext]);

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading || !hasContext) return;

    const wantsEditorInsert = /(ajoute|insere|insérer|mets|met|добавь|вставь|вставить|помести)\b.*(editeur|éditeur|редактор)/i.test(text);
    if (wantsEditorInsert && lastAssistantCode) {
      setInput('');
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', text },
        {
          id: uid(),
          role: 'ai',
          text: 'Готово. Я добавил последний блок кода в редактор. Хочешь, чтобы я полностью заменил код?',
        },
      ]);
      onApplyToEditor(lastAssistantCode, 'append');
      return;
    }

    setInput('');
    const userId = uid();
    const aiId = uid();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text },
      { id: aiId, role: 'ai', text: '__typing__' },
    ]);
    setLoading(true);

    try {
      const nextStep = sessionId ? step + 1 : 0;
      const res = await postInteractiveDebug({
        code: solutionCode,
        student_answer: text,
        session_id: sessionId,
        challenge_description: enonceText,
        console_output: consoleOutput || undefined,
        pedagogy_context: {
          tutorMode: true,
          courseTitle: 'Помощник по коду Python',
          courseDescription: enonceText,
          currentCode: solutionCode,
          pedagogicalStyle: 'Объяснение кода, уточнение концепций, помощь в понимании',
          aiTone: 'Понятный, прямой, учебный наставник',
          targetAudience: 'Изучающий Python, который хочет понять сгенерированный код',
          responseLanguage: 'простой русский',
          responseStructure: 'кратко,объяснение,действие,вопрос',
          askCheckpointQuestion: false,
        },
      });

      const aiText = String(res.data?.response ?? 'Я не получил полезного ответа.');
      const chosenMode = res.data?.tutor_strategy as TutorMode | undefined;
      setMessages((prev) => prev.map((msg) => (msg.id === aiId ? { ...msg, text: aiText } : msg)));
      setSessionId(res.data?.session_id ?? sessionId);
      setStep(Number(res.data?.step ?? (nextStep + 1)));
      if (chosenMode && chosenMode in MODE_CONFIG) setActiveTutorMode(chosenMode);
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) => (
          msg.id === aiId
            ? { ...msg, text: extractChatErrorMessage(err) }
            : msg
        )),
      );
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string, id: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(stripCodeForTts(text));
    utter.lang = 'ru-RU';
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setIsSpeaking(null);
    utter.onerror = () => setIsSpeaking(null);
    setIsSpeaking(id);
    window.speechSynthesis.speak(utter);
  }

  if (!hasContext) {
    return (
      <div className="border-2 border-dashed border-[#1C293C]/25 bg-white p-6 text-center">
        <p className="text-xs font-medium text-[#1C293C]/50">
          Сначала сгенерируй код во вкладке «Условие», чтобы использовать чат ИИ.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#1C293C]/25 bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1C293C]/15 px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
            Чат ИИ — Объяснение кода
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
              style={{ backgroundColor: MODE_CONFIG[activeTutorMode].color }}
            >
              {MODE_CONFIG[activeTutorMode].label}
            </span>
            <span className="text-[10px] text-[#1C293C]/50">{MODE_CONFIG[activeTutorMode].subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void sendMessage('Проанализируй мой текущий Python-код. Найди сильные стороны, потенциальные ошибки и предложи конкретные улучшения в редакторе.')}
            disabled={loading || !hasContext}
            className="inline-flex items-center gap-1 border border-[#432DD7] bg-white px-2 py-1 text-[10px] font-black text-[#432DD7] hover:bg-[#432DD7] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Проанализировать текущий код в редакторе"
          >
            <Zap className="h-3 w-3" /> Анализ
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => { setMessages([]); setSessionId(null); setStep(0); initKeyRef.current = ''; }}
              className="border border-[#1C293C]/20 bg-white p-1 text-[#1C293C]/50 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Сбросить диалог"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {hasErrors && (
        <div className="border-b border-orange-200 bg-orange-50 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span className="text-[11px] font-semibold text-orange-700">В терминале обнаружены ошибки</span>
          </div>
          <button
            type="button"
            onClick={() => void sendMessage('Мой код выдает ошибки в терминале. Проанализируй эти ошибки и дай полный исправленный код в Python-блоке для прямого применения в редакторе.')}
            disabled={loading}
            className="inline-flex items-center gap-1 border border-orange-400 bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-40"
          >
            <Code2 className="h-3 w-3" /> Исправить через ИИ
          </button>
        </div>
      )}

      {/* Code action buttons */}
      <div className="border-b border-[#1C293C]/10 bg-[#FBFBF9] px-2.5 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CODE_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => void sendMessage(action.prompt)}
              disabled={loading || !hasContext}
              className="inline-flex items-center gap-1 border border-[#1C293C]/20 bg-white px-2 py-1 text-[10px] font-semibold text-[#1C293C] hover:bg-[#FDC800] hover:border-[#1C293C] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span>{action.icon}</span> {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[58vh] min-h-[360px] overflow-y-auto p-2.5 space-y-2">
        {!messages.length && (
          <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-[#1C293C]/70">
              Что можно сделать здесь:
            </p>
            <p className="text-[11px] text-[#1C293C]/60">
              • Нажми <strong>Анализ</strong> для быстрого разбора сгенерированного кода.
            </p>
            <p className="text-[11px] text-[#1C293C]/60">
              • Задай вопрос по коду, концепции Python или попроси вариант решения.
            </p>
            <p className="text-[11px] text-[#1C293C]/60">
              • Когда ИИ предложит код, нажми <strong>"Заменить в редакторе"</strong>, чтобы применить сразу.
            </p>
          </div>
        )}


        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {message.role === 'ai' ? (
              <div className="max-w-[94%] space-y-1.5 border border-[#1C293C]/18 border-l-[3px] border-l-[#432DD7] bg-[#FBFBF9] p-2">
                {message.text === '__typing__' ? (
                  <TypingDots />
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => speak(message.text, message.id)}
                        className="inline-flex items-center gap-1 border border-[#1C293C]/20 bg-white px-1.5 py-1 text-[10px] font-semibold text-[#1C293C] hover:bg-[#FDC800]"
                        title={isSpeaking === message.id ? 'Остановить озвучку' : 'Озвучить'}
                      >
                        {isSpeaking === message.id ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        {isSpeaking === message.id ? 'Стоп' : 'Аудио'}
                      </button>
                    </div>
                    <MessageContent text={message.text} onApplyToEditor={onApplyToEditor} />
                  </>
                )}
              </div>
            ) : (
              <div className="max-w-[82%] border border-[#1C293C]/20 bg-[#FFF5CC] p-2">
                <MessageContent text={message.text} />
              </div>
            )}
          </div>
        ))}

        {!loading && messages.length > 0 && (
          <div className="rounded-sm border border-[#1C293C]/15 bg-white p-2">
            <div className="flex flex-wrap gap-1.5">
              {MODE_CONFIG[activeTutorMode].quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => void sendMessage(reply)}
                  className="inline-flex items-center border border-[#1C293C]/20 bg-[#FBFBF9] px-2 py-1 text-[10px] font-semibold text-[#1C293C] transition-colors hover:bg-[#FDC800]"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="border-t border-[#1C293C]/15 p-2.5 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Например: Объясни, почему это решение работает"
          className="flex-1 border border-[#1C293C]/30 bg-white px-3 py-2 text-sm font-medium text-[#1C293C] placeholder:text-[#1C293C]/30 focus:border-[#432DD7] focus:outline-none transition-colors"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={!input.trim() || loading}
          className="border border-[#1C293C]/30 bg-[#FDC800] px-3 py-2 transition-colors hover:bg-[#f0be00] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function stripCodeForTts(text: string): string {
  return text
    // Remove fenced code blocks entirely (don't say "code")
    .replace(/```[\s\S]*?```/g, '.')
    // Replace inline code with just its content, no backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic markers
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,4}\s+/gm, '')
    // Remove list markers
    .replace(/^[-•→]\s+/gm, '')
    // Remove trailing colons on section headers (avoid saying "colon")
    .replace(/:\s*$/gm, '.')
    // Collapse multiple punctuation/spaces
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}