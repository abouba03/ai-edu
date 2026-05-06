'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import axios from 'axios';
import {
  ArrowLeft,
  BookOpen,
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

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

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
    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line)) {
      const clean = line.replace(/^[-•*]\s*|^\d+\.\s*/, '').trim();
      if (clean.length > 12) notes.push(clean);
    }
  }
  return notes.slice(0, 8);
}

function MessageContent({ text }: { text: string }) {
  const segments = text.split(/(```(?:\w*\n)?[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.startsWith('```')) {
          const match = seg.match(/```(\w*)\n?([\s\S]*?)```/);
          const lang = match?.[1] ?? 'python';
          const codeContent = match?.[2]?.trim() ?? seg.slice(3, -3).trim();
          return (
            <div key={i} className="border border-[#1C293C]/20 overflow-hidden">
              <div className="flex items-center justify-between bg-[#1C293C] px-3 py-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#FDC800]">{lang || 'code'}</span>
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

        const parts = seg.split(/(`[^`]+`)/g);
        return (
          <p key={i} className="text-[12px] text-[#1C293C] leading-relaxed whitespace-pre-wrap">
            {parts.map((part, j) => {
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code key={j} className="bg-[#1C293C]/10 px-1 py-0.5 text-[11px] font-mono text-[#1C293C]">
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

function TypingSkeleton() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#1C293C]/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function TuteurChat() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const courseTitle = searchParams.get('title') ?? 'Cours';
  const level = searchParams.get('level') ?? 'debutant';
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
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const buildPedagogyContext = (extra?: Record<string, unknown>) => ({
    courseTitle,
    courseDescription,
    level,
    progressPercent,
    tutorMode: true,
    responseLanguage: 'русский простой',
    pedagogicalStyle: 'Tutorat bienveillant et conversationnel',
    aiTone: 'Tuteur chaleureux, pedagogue, repond toujours en russe',
    language: 'ru',
    targetAudience: formationName,
    ...extra,
  });

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
            introInstructions: 'Presente-toi comme tuteur et pose une question de niveau. Reponds en russe.',
          }),
        })
        .catch(() => null);

      const examplesPromise = axios
        .post(`${apiBaseUrl}/generate/`, {
          prompt: `Genere 3 exemples Python courts (commentaires en russe) pour le cours "${courseTitle}". Separe par ###.`,
          pedagogy_context: {
            level,
            pedagogicalStyle: 'Exemples pratiques courts',
            aiTone: 'Pedagogue clair',
            responseLanguage: 'русский простой',
          },
        })
        .catch(() => null);

      const [welcomeRes, examplesRes] = await Promise.all([welcomePromise, examplesPromise]);
      if (cancelled) return;

      if (welcomeRes?.data?.response) {
        const text: string = welcomeRes.data.response;
        setMessages([{ role: 'ai', text, id: uid() }]);
        setSessionId(welcomeRes.data.session_id ?? null);
        setStep(Number(welcomeRes.data.step ?? 1));
        const parsed = parseNotes(text);
        if (parsed.length > 0) setNotes(parsed);
      } else {
        setMessages([{ role: 'ai', text: `Привет! Я твой наставник по курсу **${courseTitle}**.`, id: uid() }]);
      }

      setInitialLoading(false);

      if (examplesRes?.data?.code) {
        const raw: string = examplesRes.data.code;
        const parts = raw.split(/^###\s*$/m).map((s: string) => s.trim()).filter((s: string) => s.length > 10);
        setExamples(parts.length > 0 ? parts : [raw]);
      } else {
        setExamples([]);
      }
      setExamplesLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [courseTitle, level]);

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
      setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, text: aiText } : m)));
      setSessionId(res.data.session_id ?? sessionId);
      setStep(Number(res.data.step ?? step + 1));

      const parsed = parseNotes(aiText);
      if (parsed.length > 0) {
        setNotes((prev) => [...new Set([...prev, ...parsed])].slice(0, 8));
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, text: 'Ошибка соединения.' } : m)));
    } finally {
      setLoading(false);
    }
  }

  function analyzeCode() {
    const trimmed = code.trim();
    if (!trimmed || trimmed === '# Напиши свой Python-код здесь') return;
    void sendMessage(`Разбери этот код пошагово:\n\`\`\`python\n${trimmed}\n\`\`\``);
  }

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
        setConsoleOutput(`${stdout ? `${stdout}\n` : ''}Ошибка: ${error}${trace ? `\n${trace}` : ''}`);
      }
    } catch {
      setConsoleOutput('Ошибка: невозможно выполнить код.');
    } finally {
      setRunLoading(false);
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
    utter.rate = 0.95;
    utter.onend = () => setIsSpeaking(null);
    utter.onerror = () => setIsSpeaking(null);
    setIsSpeaking(id);
    window.speechSynthesis.speak(utter);
  }

  function toggleListen() {
    if (typeof window === 'undefined') return;
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FBFBF9]">
      <section className="shrink-0 border-b-2 border-[#1C293C] bg-[#FBFBF9] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {slug && (
            <Link href={`/courses/${slug}`} className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-2.5 py-1.5 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100">
              <ArrowLeft className="h-3 w-3" /> Назад
            </Link>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">ИИ-наставник</p>
            <h1 className="font-black text-sm text-[#1C293C] leading-tight line-clamp-1">{courseTitle}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {level && <span className="border border-[#1C293C]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">{level}</span>}
          {progressPercent > 0 && <span className="border border-[#432DD7] bg-white px-2 py-0.5 text-[10px] font-bold text-[#432DD7]">{progressPercent}%</span>}
          {formationName && <span className="border border-[#1C293C]/30 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C293C]">{formationName}</span>}
        </div>
      </section>

      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        <div className="h-full flex flex-col xl:flex-row gap-2">
          <div className="flex-1 min-h-0 order-2 xl:order-1 border-2 border-[#1C293C] bg-white shadow-[4px_4px_0px_0px_#1C293C] flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {initialLoading ? <TypingSkeleton /> : messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'border-l-4 border-l-[#FDC800] bg-[#FDC800]/10 pl-3 pr-2 py-2' : 'border-l-4 border-l-[#432DD7] pl-3 pr-2 py-2'}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1C293C]/70">{m.role === 'user' ? 'Ты' : 'Наставник'}</p>
                    {m.role === 'ai' && m.text !== '__typing__' && (
                      <button onClick={() => speak(m.text, m.id)} className="text-[#1C293C]/50 hover:text-[#1C293C] transition-colors">
                        {isSpeaking === m.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-[#1C293C]">{m.text === '__typing__' ? <TypingSkeleton /> : <MessageContent text={m.text} />}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t-2 border-[#1C293C]/20 p-2 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} disabled={loading || initialLoading} className="border border-[#1C293C]/20 bg-white px-2 py-1 text-[10px] font-black text-[#1C293C] hover:border-[#1C293C] hover:bg-[#FDC800] transition-colors disabled:opacity-40">
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendMessage(); } }} placeholder="Напиши вопрос..." className="min-w-0 flex-1 border border-[#1C293C]/20 bg-white px-2.5 py-2 text-xs text-[#1C293C] placeholder:text-[#1C293C]/40 focus:outline-none focus:border-[#432DD7] focus:ring-1 focus:ring-[#432DD7]/30 rounded-sm transition-colors" />
                <button onClick={toggleListen} title={isListening ? 'Остановить' : 'Голосовой ввод'} className={`shrink-0 border border-[#1C293C]/20 p-1.5 rounded-sm hover:border-[#1C293C] transition-colors ${isListening ? 'bg-[#432DD7] text-white border-[#432DD7]' : 'bg-white text-[#1C293C]'}`}>
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading || initialLoading} className="shrink-0 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <aside className="w-full xl:w-[420px] shrink-0 order-1 xl:order-2 border-2 border-[#1C293C] bg-white shadow-[4px_4px_0px_0px_#1C293C] flex flex-col overflow-hidden">
            <div className="shrink-0 flex border-b-2 border-[#1C293C]/20">
              {[{ key: 'code' as Tab, label: 'Код', icon: <Code2 className="h-3.5 w-3.5" /> }, { key: 'examples' as Tab, label: 'Примеры', icon: <BookOpen className="h-3.5 w-3.5" /> }, { key: 'notes' as Tab, label: 'Конспект', icon: <BookOpen className="h-3.5 w-3.5" /> }].map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 inline-flex items-center justify-center gap-1 py-2 text-[10px] font-black border-r border-[#1C293C]/20 last:border-r-0 transition-colors ${activeTab === tab.key ? 'bg-[#1C293C] text-white' : 'bg-white text-[#1C293C] hover:bg-[#FDC800]'}`}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {activeTab === 'code' && (
                <div className="space-y-2">
                  <div className="border-2 border-[#1C293C] overflow-hidden">
                    <Editor height="200px" defaultLanguage="python" value={code} onChange={(value) => setCode(value ?? '')} theme="vs-light" options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'on', tabSize: 4 }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={runCode} disabled={runLoading || !code.trim() || code.trim() === '# Напиши свой Python-код здесь'} className="inline-flex items-center justify-center gap-1.5 border-2 border-[#1C293C] bg-[#1C293C] text-white py-2 text-[11px] font-black shadow-[2px_2px_0px_0px_#432DD7] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"><Play className="h-3.5 w-3.5" />{runLoading ? 'Запуск...' : 'Запустить'}</button>
                    <button onClick={analyzeCode} disabled={loading || !code.trim() || code.trim() === '# Напиши свой Python-код здесь'} className="inline-flex items-center justify-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] py-2 text-[11px] font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed">Разобрать</button>
                  </div>
                  {consoleOutput !== null && (
                    <div className="border-2 border-[#1C293C] overflow-hidden">
                      <div className="flex items-center justify-between bg-[#1C293C] px-3 py-1.5">
                        <div className="flex items-center gap-2"><Terminal className="h-3 w-3 text-[#FDC800]" /><span className="text-[10px] font-black uppercase tracking-widest text-[#FDC800]">Вывод</span></div>
                        <button onClick={() => setConsoleOutput(null)} className="text-white/50 hover:text-white transition-colors"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <pre className="bg-[#0d1117] px-3 py-3 text-[12px] font-mono text-[#e6edf3] whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{consoleOutput}</pre>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'examples' && (
                <div className="space-y-1.5">
                  {examplesLoading && <div className="text-[11px] text-[#1C293C]/50">Загрузка примеров...</div>}
                  {!examplesLoading && examples.length === 0 && <div className="text-[11px] text-[#1C293C]/50">Примеры не удалось загрузить.</div>}
                  {!examplesLoading && examples.map((ex, i) => {
                    const isCode = ex.includes('\n') || ex.trim().startsWith('#');
                    return (
                      <div key={i} className="border-l-4 border-l-[#432DD7] bg-[#432DD7]/5 pl-2.5 pr-2 py-2">
                        <p className="text-[10px] font-black text-[#432DD7] uppercase tracking-widest mb-1">Пример {i + 1}</p>
                        {isCode ? <pre className="text-[10px] text-[#1C293C] font-mono leading-relaxed overflow-x-auto whitespace-pre mb-1.5">{ex}</pre> : <p className="text-[11px] font-medium text-[#1C293C] leading-relaxed mb-1.5">{ex}</p>}
                        <div className="flex gap-1">
                          <button onClick={() => { setCode(ex); setActiveTab('code'); setConsoleOutput(null); }} className="flex-1 border border-[#1C293C]/20 bg-white px-2 py-1 text-[10px] font-black text-[#1C293C] hover:border-[#1C293C] transition-colors rounded-sm">Открыть</button>
                          <button onClick={() => sendMessage(`Объясни этот пример:\n\`\`\`python\n${ex}\n\`\`\``)} className="flex-1 border border-[#432DD7] bg-white px-2 py-1 text-[10px] font-black text-[#432DD7] hover:bg-[#432DD7] hover:text-white transition-colors rounded-sm">Объяснить</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <div className="text-[11px] text-[#1C293C]/50">Конспект формируется автоматически.</div>
                  ) : (
                    <ul className="space-y-2">
                      {notes.map((note, i) => (
                        <li key={i} className="border-l-4 border-l-[#432DD7] bg-[#432DD7]/5 pl-2 pr-2 py-1.5 flex gap-1.5">
                          <span className="text-[10px] font-black text-[#432DD7] mt-0.5 shrink-0">{i + 1}.</span>
                          <p className="text-[11px] font-medium text-[#1C293C] leading-relaxed">{note}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
