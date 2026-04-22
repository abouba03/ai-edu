'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Send, Volume2, VolumeX } from 'lucide-react';

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
  level: 'debutant' | 'intermediaire' | 'avance';
  onApplyToEditor: (code: string, mode: 'replace' | 'append') => void;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002';
const CHAT_TIMEOUT_PRIMARY_MS = 30000;
const CHAT_TIMEOUT_FALLBACK_MS = 4500;

const MODE_CONFIG: Record<TutorMode, { label: string; subtitle: string; color: string; quickReplies: string[] }> = {
  coach: {
    label: 'Coach',
    color: '#432DD7',
    subtitle: 'Explications directes et plan d action',
    quickReplies: [
      'Explique moi ce code etape par etape',
      'Donne-moi une mini checklist pour valider ma solution',
    ],
  },
  socratique: {
    label: 'Socratique',
    color: '#0B6E4F',
    subtitle: 'Questions guidees pour raisonner par soi-meme',
    quickReplies: [
      'Pose moi 3 questions pour trouver mon erreur',
      'Aide-moi a deduire la logique sans donner la reponse',
    ],
  },
  creatif: {
    label: 'Creatif',
    color: '#D97706',
    subtitle: 'Analogies et mini defi pour memoriser',
    quickReplies: [
      'Explique avec une analogie simple',
      'Propose un mini defi de 5 minutes sur cet exercice',
    ],
  },
};

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

  const normalizeText = (value: string): string => {
    return value
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

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
                    Remplacer dans l editeur
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyToEditor(codeContent, 'append')}
                    className="border border-[#1C293C]/30 px-2 py-1 text-[10px] font-bold text-[#1C293C] hover:bg-[#FDC800]"
                  >
                    Ajouter dans l editeur
                  </button>
                </div>
              )}
            </div>
          );
        }

        const cleaned = normalizeText(segment);
        if (!cleaned) return null;

        const lines = cleaned.split('\n');

        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={`${index}-${lineIndex}`} className="h-1" />;
              }

              const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numbered) {
                return (
                  <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C]">
                    <span className="font-semibold text-[#432DD7]">{numbered[1]}.</span> {numbered[2]}
                  </p>
                );
              }

              const dashed = trimmed.match(/^[-•]\s+(.*)$/);
              if (dashed) {
                return (
                  <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C]">
                    <span className="font-semibold text-[#432DD7]">-</span> {dashed[1]}
                  </p>
                );
              }

              return (
                <p key={`${index}-${lineIndex}`} className="text-[12px] text-[#1C293C]">
                  {trimmed}
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
  level,
  onApplyToEditor,
}: GeneratorTutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resolvedApiBase, setResolvedApiBase] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [activeTutorMode, setActiveTutorMode] = useState<TutorMode>('coach');
  const endRef = useRef<HTMLDivElement>(null);
  const initKeyRef = useRef<string>('');

  // Keep context stable to avoid re-initializing chat at each code keystroke.
  const contextKey = useMemo(
    () => `${challengeDescription}\n---\n${enonceText}`,
    [challengeDescription, enonceText],
  );
  const hasContext = Boolean(challengeDescription.trim() || enonceText.trim() || solutionCode.trim());
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
        return 'Le tuteur met trop de temps a repondre. Reessaie dans quelques secondes.';
      }

      if (!err.response) {
        return 'Backend indisponible pour le chat. Verifie que l API tourne.';
      }
    }
    return 'Erreur de connexion. Impossible de parler au tuteur pour le moment.';
  }

  async function postInteractiveDebug(payload: Record<string, unknown>) {
    const candidates = [
      resolvedApiBase,
      apiBaseUrl,
      'http://127.0.0.1:8002',
      'http://localhost:8002',
      'http://127.0.0.1:8000',
      'http://localhost:8000',
    ].filter((value): value is string => Boolean(value));

    const uniqueCandidates = [...new Set(candidates)];
    let lastError: unknown = null;

    for (let i = 0; i < uniqueCandidates.length; i += 1) {
      const base = uniqueCandidates[i];
      const timeout = i === 0 ? CHAT_TIMEOUT_PRIMARY_MS : CHAT_TIMEOUT_FALLBACK_MS;
      try {
        const res = await axios.post(`${base}/interactive-debug/`, payload, { timeout });
        setResolvedApiBase(base);
        return res;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
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
  }, [active, challengeDescription, contextKey, enonceText, hasContext, level, solutionCode]);

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading || !hasContext) return;

    const wantsEditorInsert = /(ajoute|insere|insérer|mets|met)\b.*(editeur|éditeur)/i.test(text);
    if (wantsEditorInsert && lastAssistantCode) {
      setInput('');
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', text },
        {
          id: uid(),
          role: 'ai',
          text: 'C est fait. J ai ajoute le dernier bloc de code dans l editeur. Souhaites-tu que je remplace tout le code a la place ?',
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
        level,
        step: nextStep,
        student_answer: text,
        session_id: sessionId,
        challenge_description: challengeDescription || enonceText,
        pedagogy_context: {
          tutorMode: true,

          courseTitle: 'Assistant exercice',
          courseDescription: enonceText || challengeDescription,
          pedagogicalStyle: 'Tutorat interactif, progressif et centre sur la comprehension',
          aiTone: 'Tuteur academique clair, motivant et creatif',
          targetAudience: 'Etudiant en progression vers l autonomie',
          responseLanguage: 'francais simple',
          responseStructure: 'resume,explication,action,question',
          askCheckpointQuestion: true,
          innovationGoal: 'apprentissage actif et memorisation durable',
        },
      });

      const aiText = String(res.data?.response ?? 'Je n ai pas recu de reponse utile.');
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
    utter.lang = 'fr-FR';
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
          Genere d abord un exercice et du code pour ouvrir le chat pedagogique.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#1C293C]/25 bg-white flex flex-col">
      <div className="border-b border-[#1C293C]/15 px-3 py-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
            Chat IA pedagogique
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
        <span className="text-[10px] font-bold text-[#1C293C]/45">
          {messages.filter((message) => message.role === 'user').length > 0
            ? `${messages.filter((message) => message.role === 'user').length} messages`
            : 'Nouvelle session'}
        </span>
      </div>

      <div className="max-h-[58vh] min-h-[360px] overflow-y-auto p-2.5 space-y-2">
        {!messages.length && (
          <div className="border border-[#1C293C]/15 bg-[#FBFBF9] p-2.5">
            <p className="text-[11px] font-semibold text-[#1C293C]/70">
              Commence par poser ta premiere question sur l enonce ou le code.
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
                        title={isSpeaking === message.id ? 'Arreter la lecture audio' : 'Lire en audio'}
                      >
                        {isSpeaking === message.id ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        {isSpeaking === message.id ? 'Stop' : 'Audio'}
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

        {!loading && (
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
          placeholder="Ex: Explique-moi pourquoi cette solution fonctionne"
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
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}