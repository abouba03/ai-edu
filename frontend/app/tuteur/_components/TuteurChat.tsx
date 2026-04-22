'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Editor, { loader } from '@monaco-editor/react';
import axios from 'axios';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Code2,
  Mic,
  MicOff,
  Play,
  Send,
  Terminal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

loader.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' },
});

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Message = { role: 'user' | 'ai'; text: string; id: string };
type Tab = 'code' | 'examples' | 'notes';

const QUICK_REPLIES = [
  'Объясни подробнее',
  'Покажи пример',
  'Дай мне задание',
  'Я не понял',
  'Как это применить?',
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function stripCodeForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[код]')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function parseNotes(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const notes: string[] = [];
  for (const line of lines) {
    if (
      line.startsWith('-') ||
      line.startsWith('•') ||
      line.startsWith('*') ||
      /^\d+\./.test(line)
    ) {
      const clean = line.replace(/^[-•*]|\d+\.\s*/, '').trim();
      if (clean.length > 12) notes.push(clean);
    }
  }
  return notes.slice(0, 8);
}

// ── Rich message content renderer ──────────────────────────────────────
function MessageContent({ text }: { text: string }) {
  // Split on fenced code blocks first
  const segments = text.split(/(```(?:\w*\n)?[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {segments.map((seg, i) => {
        // Fenced code block
        if (seg.startsWith('```')) {
          const match = seg.match(/```(\w*)\n?([\s\S]*?)```/);
          const lang = match?.[1] ?? 'python';
          const codeContent = match?.[2]?.trim() ?? seg.slice(3, -3).trim();
          return (
            <div key={i} className="border border-[#1C293C]/20 overflow-hidden">
              <div className="flex items-center justify-between bg-[#1C293C] px-3 py-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#FDC800]">
                  {lang || 'code'}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(codeContent)}
                  className="text-[9px] text-white/50 hover:text-white transition-colors"
                >
                  копировать
                </button>
              </div>
              <pre className="bg-[#0d1117] px-3 py-2.5 text-[12px] font-mono text-[#e6edf3] overflow-x-auto whitespace-pre">
                {codeContent}
              </pre>
            </div>
          );
        }

        // Regular text — handle **bold** and `inline code`
        const parts = seg.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i} className="font-medium text-[#1C293C] whitespace-pre-wrap">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={j} className="font-black">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={j}
                    className="bg-[#432DD7]/10 text-[#432DD7] px-1 py-0.5 text-[11px] font-mono"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 bg-[#432DD7] animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────
export default function TuteurChat() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const courseTitle = searchParams.get('title') ?? 'Cours';
  const level = searchParams.get('level') ?? 'débutant';
  const courseDescription = searchParams.get('description') ?? '';
  const formationName = searchParams.get('formation') ?? '';
  const progressPercent = Number(searchParams.get('progress') ?? '0');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('# Напиши свой Python-код здесь\n');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('code');
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpeechRecognition API uses generic types
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Context helpers ──
  const buildPedagogyContext = (extra?: Record<string, unknown>) => ({
    courseTitle,
    courseDescription,
    level,
    progressPercent,
    tutorMode: true,
    responseLanguage: 'русский',
    pedagogicalStyle: 'Tutorat bienveillant et conversationnel',
    aiTone: 'Tuteur chaleureux, pédagogue, répond toujours en russe',
    language: 'ru',
    targetAudience: formationName,
    ...extra,
  });

  // ── Auto-start ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const welcomePromise = axios
        .post(`${apiBaseUrl}/interactive-debug/`, {
          code: '',
          level,
          step: 0,
          student_answer: '',
          session_id: null,
          pedagogy_context: buildPedagogyContext({
            introInstructions:
              "Présente-toi comme tuteur de ce cours. Explique brièvement ce que l'étudiant va apprendre. Pose une question pour évaluer son niveau actuel. En russe.",
          }),
        })
        .catch(() => null);

      const examplesPromise = axios
        .post(`${apiBaseUrl}/generate/`, {
          prompt: `Génère 3 exemples de code Python courts et bien commentés (commentaires en russe) pour illustrer le cours "${courseTitle}" (niveau ${level}). Sépare chaque exemple par une ligne exactement "###".`,
          pedagogy_context: {
            level,
            pedagogicalStyle: 'Exemples pratiques courts',
            aiTone: 'Pédagogue clair',
          },
        })
        .catch(() => null);

      const [welcomeRes, examplesRes] = await Promise.all([
        welcomePromise,
        examplesPromise,
      ]);

      if (cancelled) return;

      if (welcomeRes?.data?.response) {
        const text: string = welcomeRes.data.response;
        const msgId = uid();
        setMessages([{ role: 'ai', text, id: msgId }]);
        setSessionId(welcomeRes.data.session_id ?? null);
        setStep(Number(welcomeRes.data.step ?? 1));
        const parsed = parseNotes(text);
        if (parsed.length > 0) setNotes(parsed);
      } else {
        setMessages([
          {
            role: 'ai',
            text: `Привет! Я твой наставник по курсу **${courseTitle}**.\n\nЗадавай вопросы, вставляй код — разберём всё вместе. С чего начнём?`,
            id: uid(),
          },
        ]);
      }

      setInitialLoading(false);

      if (examplesRes?.data?.code) {
        const raw: string = examplesRes.data.code;
        const parts = raw
          .split(/^###\s*$/m)
          .map((s) => s.trim())
          .filter((s) => s.length > 10);
        setExamples(parts.length > 0 ? parts : [raw]);
      } else {
        setExamples([]);
      }
      setExamplesLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Send message ──
  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput('');

    const userMsgId = uid();
    setMessages((prev) => [...prev, { role: 'user', text, id: userMsgId }]);
    setLoading(true);

    const aiMsgId = uid();
    setMessages((prev) => [...prev, { role: 'ai', text: '__typing__', id: aiMsgId }]);

    try {
      const res = await axios.post(`${apiBaseUrl}/interactive-debug/`, {
        code: code.trim() || '',
        level,
        step: step + 1,
        student_answer: text,
        session_id: sessionId,
        pedagogy_context: buildPedagogyContext(),
      });

      const aiText: string = res.data.response ?? 'Ответ не получен.';
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, text: aiText } : m))
      );
      setSessionId(res.data.session_id ?? sessionId);
      setStep(Number(res.data.step ?? step + 1));

      if (notes.length < 3) {
        const parsed = parseNotes(aiText);
        if (parsed.length > 0)
          setNotes((prev) => {
            const merged = [...prev, ...parsed];
            return [...new Set(merged)].slice(0, 8);
          });
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: 'Ошибка соединения. Попробуй ещё раз.' }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Analyze code (send to chat) ──
  function analyzeCode() {
    const trimmed = code.trim();
    if (!trimmed || trimmed === '# Напиши свой Python-код здесь') return;
    sendMessage(`Разбери этот код пошагово:\n\`\`\`python\n${trimmed}\n\`\`\``);
  }

  // ── Run code → real Python execution ──
  async function runCode() {
    const trimmed = code.trim();
    if (!trimmed || trimmed === '# Напиши свой Python-код здесь') return;
    setRunLoading(true);
    setConsoleOutput(null);
    try {
      const res = await axios.post(`${apiBaseUrl}/execute-console/`, {
        code: trimmed,
        stdin_lines: [],
      });
      const { success, stdout, error, trace } = res.data;
      if (success) {
        setConsoleOutput(stdout || '(нет вывода)');
      } else {
        setConsoleOutput(
          `${stdout ? stdout + '\n' : ''}Ошибка: ${error}${trace ? '\n' + trace : ''}`
        );
      }
    } catch {
      setConsoleOutput('Ошибка: невозможно выполнить код.');
    } finally {
      setRunLoading(false);
    }
  }

  // ── TTS ──
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
    utter.rate = 0.95;
    utter.onend = () => setIsSpeaking(null);
    utter.onerror = () => setIsSpeaking(null);
    setIsSpeaking(id);
    window.speechSynthesis.speak(utter);
  }

  // ── STT ──
  function toggleListen() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Window API types not strictly typed
    const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!SR) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpeechRecognition API event type is generic
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  const lastAiMsgId = [...messages].reverse().find((m) => m.role === 'ai' && m.text !== '__typing__')?.id;

  // ── RENDER ──
  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-3 pb-6">

      {/* HEADER */}
      <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {slug && (
              <Link
                href={`/courses/${slug}`}
                className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-2.5 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 shrink-0"
              >
                <ArrowLeft className="h-3 w-3" />
                Назад
              </Link>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                ИИ-наставник
              </p>
              <h1 className="font-black text-sm text-[#1C293C] leading-tight line-clamp-1">
                {courseTitle}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {level && (
              <span className="border border-[#1C293C]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">
                {level}
              </span>
            )}
            {progressPercent > 0 && (
              <span className="border border-[#432DD7] bg-white px-2 py-0.5 text-[10px] font-bold text-[#432DD7]">
                {progressPercent}% пройдено
              </span>
            )}
            {formationName && (
              <span className="border border-[#1C293C]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">
                {formationName}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">

        {/* ── LEFT: CHAT ── */}
        <div className="xl:col-span-7 order-2 xl:order-1 flex flex-col gap-3">
          <div className="border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C] flex flex-col">

            {/* Chat header */}
            <div className="border-b-2 border-[#1C293C] px-4 py-2.5 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                Диалог с наставником
              </p>
              <span className="text-[10px] font-bold text-[#1C293C]/40">
                {messages.filter((m) => m.role === 'user').length > 0
                  ? `${messages.filter((m) => m.role === 'user').length} сообщений`
                  : 'Новая сессия'}
              </span>
            </div>

            {/* Messages */}
            <div className="overflow-y-auto max-h-[62vh] min-h-[340px] p-3 space-y-3">
              {initialLoading && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-20 border-2 border-[#432DD7]/20 bg-[#432DD7]/5 w-5/6" />
                  <div className="h-8 border-2 border-[#1C293C]/10 bg-[#1C293C]/5 w-3/5" />
                </div>
              )}

              {messages.map((msg) => {
                const isLastAi = msg.id === lastAiMsgId;
                const isTyping = msg.text === '__typing__';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {msg.role === 'ai' ? (
                      <div className="border-2 border-[#1C293C] border-l-[5px] border-l-[#432DD7] bg-white p-3.5 max-w-[95%] shadow-[2px_2px_0px_0px_#1C293C] space-y-2.5">
                        <p className="text-[10px] font-black text-[#432DD7] uppercase tracking-widest">
                          Наставник
                        </p>

                        {isTyping ? (
                          <TypingDots />
                        ) : (
                          <>
                            <MessageContent text={msg.text} />

                            {/* TTS + quick actions */}
                            <div className="flex items-center gap-2 pt-1 border-t border-[#1C293C]/10">
                              <button
                                onClick={() => speak(msg.text, msg.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1C293C]/40 hover:text-[#432DD7] transition-colors"
                              >
                                {isSpeaking === msg.id ? (
                                  <><VolumeX className="h-3 w-3" />Стоп</>
                                ) : (
                                  <><Volume2 className="h-3 w-3" />Слушать</>
                                )}
                              </button>
                            </div>

                            {/* Quick-reply chips — only after last AI message */}
                            {isLastAi && !loading && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {QUICK_REPLIES.map((reply) => (
                                  <button
                                    key={reply}
                                    onClick={() => sendMessage(reply)}
                                    className="inline-flex items-center gap-1 border border-[#1C293C]/25 bg-[#FBFBF9] px-2.5 py-1 text-[11px] font-bold text-[#1C293C] hover:bg-[#FDC800] hover:border-[#1C293C] transition-colors"
                                  >
                                    <ChevronRight className="h-2.5 w-2.5 text-[#432DD7]" />
                                    {reply}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-[#1C293C] bg-[#FDC800] p-3 max-w-[78%] shadow-[2px_2px_0px_0px_#1C293C]">
                        <p className="text-[10px] font-black text-[#1C293C] uppercase tracking-widest mb-1">
                          Ты
                        </p>
                        <MessageContent text={msg.text} />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input row */}
            <div className="border-t-2 border-[#1C293C] p-3 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Задай вопрос или напиши ответ..."
                className="flex-1 border-2 border-[#1C293C] bg-white px-3 py-2 text-sm font-medium text-[#1C293C] placeholder:text-[#1C293C]/30 focus:outline-none focus:border-[#432DD7] transition-colors"
                disabled={loading || initialLoading}
              />
              <button
                onClick={toggleListen}
                title={isListening ? 'Остановить' : 'Голосовой ввод'}
                className={`border-2 border-[#1C293C] p-2 shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 ${
                  isListening
                    ? 'bg-[#432DD7] text-white'
                    : 'bg-white text-[#1C293C]'
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || initialLoading}
                className="border-2 border-[#1C293C] bg-[#FDC800] px-3 py-2 shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0px_0px_#1C293C] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: TOOLS ── */}
        <aside className="xl:col-span-5 order-1 xl:order-2 xl:sticky xl:top-3">
          <div className="border-2 border-[#1C293C] bg-[#FBFBF9] shadow-[4px_4px_0px_0px_#1C293C]">

            {/* Tab bar */}
            <div className="flex border-b-2 border-[#1C293C]">
              {(
                [
                  { key: 'code' as Tab, label: 'Код', icon: <Code2 className="h-3.5 w-3.5" /> },
                  { key: 'examples' as Tab, label: 'Примеры', icon: <BookOpen className="h-3.5 w-3.5" /> },
                  { key: 'notes' as Tab, label: 'Конспект', icon: <BookOpen className="h-3.5 w-3.5" /> },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black border-r-2 border-[#1C293C] last:border-r-0 transition-colors ${
                    activeTab === tab.key
                      ? 'bg-[#1C293C] text-white'
                      : 'bg-white text-[#1C293C] hover:bg-[#FDC800]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3">

              {/* ── TAB: CODE ── */}
              {activeTab === 'code' && (
                <div className="space-y-2.5">
                  <div className="border-2 border-[#1C293C] overflow-hidden">
                    <Editor
                      height="260px"
                      defaultLanguage="python"
                      value={code}
                      onChange={(value) => setCode(value ?? '')}
                      theme="vs-light"
                      options={{
                        fontSize: 13,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        tabSize: 4,
                        renderLineHighlight: 'line',
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={runCode}
                      disabled={runLoading || !code.trim() || code.trim() === '# Напиши свой Python-код здесь'}
                      className="inline-flex items-center justify-center gap-1.5 border-2 border-[#1C293C] bg-[#1C293C] text-white py-2 text-[11px] font-black shadow-[2px_2px_0px_0px_#432DD7] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0px_0px_#432DD7] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {runLoading ? 'Запуск...' : 'Запустить'}
                    </button>
                    <button
                      onClick={analyzeCode}
                      disabled={loading || !code.trim() || code.trim() === '# Напиши свой Python-код здесь'}
                      className="inline-flex items-center justify-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] py-2 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0px_0px_#1C293C] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                    >
                      Разобрать
                    </button>
                  </div>

                  {/* Console output */}
                  {consoleOutput !== null && (
                    <div className="border-2 border-[#1C293C] overflow-hidden">
                      <div className="flex items-center justify-between bg-[#1C293C] px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-3 w-3 text-[#FDC800]" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#FDC800]">
                            Вывод
                          </span>
                        </div>
                        <button
                          onClick={() => setConsoleOutput(null)}
                          className="text-white/50 hover:text-white transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <pre className="bg-[#0d1117] px-3 py-3 text-[12px] font-mono text-[#e6edf3] whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {consoleOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: EXAMPLES ── */}
              {activeTab === 'examples' && (
                <div className="space-y-3 max-h-[520px] overflow-y-auto">
                  {examplesLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-28 border-2 border-[#1C293C]/15 bg-[#1C293C]/5" />
                      ))}
                    </div>
                  ) : examples.length === 0 ? (
                    <div className="border-2 border-dashed border-[#1C293C]/25 p-6 text-center">
                      <p className="text-xs font-medium text-[#1C293C]/50">
                        Примеры не удалось загрузить.
                      </p>
                    </div>
                  ) : (
                    examples.map((ex, i) => {
                      const isCode = ex.includes('\n') || ex.trim().startsWith('#');
                      return (
                        <div
                          key={i}
                          className="border-2 border-[#1C293C] bg-white shadow-[2px_2px_0px_0px_#1C293C]"
                        >
                          <div className="px-3 pt-3 pb-1">
                            <p className="text-[10px] font-black text-[#432DD7] uppercase tracking-widest mb-2">
                              Пример {i + 1}
                            </p>
                            {isCode ? (
                              <pre className="text-[11px] text-[#1C293C] font-mono leading-relaxed overflow-x-auto whitespace-pre">
                                {ex}
                              </pre>
                            ) : (
                              <p className="text-sm font-medium text-[#1C293C] leading-relaxed">
                                {ex}
                              </p>
                            )}
                          </div>
                          <div className="border-t-2 border-[#1C293C] px-3 py-2 flex gap-2">
                            <button
                              onClick={() => {
                                setCode(ex);
                                setActiveTab('code');
                                setConsoleOutput(null);
                              }}
                              className="flex-1 border-2 border-[#1C293C] bg-[#FBFBF9] py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                            >
                              Открыть
                            </button>
                            <button
                              onClick={() => sendMessage(`Объясни этот пример:\n\`\`\`python\n${ex}\n\`\`\``)}
                              className="flex-1 border-2 border-[#432DD7] bg-white py-1.5 text-[11px] font-black text-[#432DD7] hover:bg-[#432DD7] hover:text-white transition-colors"
                            >
                              Объяснить
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── TAB: NOTES ── */}
              {activeTab === 'notes' && (
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <div className="border-2 border-dashed border-[#1C293C]/25 bg-white p-6 text-center">
                      <p className="text-[11px] font-medium text-[#1C293C]/50">
                        Конспект формируется автоматически по ходу разговора с наставником.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                        Ключевые моменты
                      </p>
                      <ul className="space-y-2">
                        {notes.map((note, i) => (
                          <li
                            key={i}
                            className="border-2 border-[#1C293C] bg-white p-3 shadow-[2px_2px_0px_0px_#1C293C] flex gap-2"
                          >
                            <span className="text-[10px] font-black text-[#432DD7] mt-0.5 shrink-0">
                              {i + 1}.
                            </span>
                            <p className="text-[12px] font-medium text-[#1C293C] leading-relaxed">
                              {note}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
