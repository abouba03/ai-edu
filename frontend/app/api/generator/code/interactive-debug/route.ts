import { randomUUID } from 'crypto';
import { callOpenAI } from '@/lib/generator-ai/openai';
import {
  createTutorSession,
  getTutorSession,
  saveTutorSession,
  type TutorSession,
  type TutorStrategy,
} from '@/lib/generator-ai/tutor-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DebugRequest = {
  code?: string;
  level?: string;
  step?: number;
  student_answer?: string;
  session_id?: string | null;
  challenge_description?: string;
  console_output?: string;
  pedagogy_context?: Record<string, unknown>;
};

function autoSelectStrategy(answer: string, historySize: number, level: string): TutorStrategy {
  const a = answer.toLowerCase();
  const beginner = level.includes('debut') || level.includes('début');

  const asksReasoning = /(je pense|je crois|peut etre|peut-etre|est ce que|est-ce que)/i.test(a);
  const asksHelp = /(pourquoi|comment|je suis perdu|je ne comprends|erreur)/i.test(a);
  const asksCreative = /(exemple|analogie|defi|défi|metaphore|métaphore)/i.test(a);

  if (beginner || historySize <= 1) return 'coach';
  if (asksCreative) return 'creatif';
  if (asksReasoning || asksHelp) return 'socratique';
  return historySize % 3 === 0 ? 'socratique' : 'coach';
}

function strategyRule(strategy: TutorStrategy): string {
  switch (strategy) {
    case 'socratique':
      return 'Guide surtout par questions progressives et laisse l etudiant deduire.';
    case 'creatif':
      return 'Utilise une analogie concrete puis propose un mini-defi court.';
    case 'coach':
    default:
      return 'Donne des explications claires puis une action immediate faisable.';
  }
}

export async function POST(req: Request) {
  let body: DebugRequest;
  try {
    body = (await req.json()) as DebugRequest;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const answer = String(body.student_answer || '').trim();
  const level = String(body.level || 'debutant').trim();
  const code = String(body.code || '').trim();
  const challengeDescription = String(body.challenge_description || '').trim();
  const consoleOutput = String(body.console_output || '').trim();
  const responseLanguage = String(body.pedagogy_context?.responseLanguage || 'francais simple');

  let session: TutorSession;
  const requestedSessionId = String(body.session_id || '').trim();

  if (requestedSessionId) {
    const existing = getTutorSession(requestedSessionId);
    if (!existing) {
      session = createTutorSession({
        id: requestedSessionId,
        level,
        code,
        challengeDescription,
      });
    } else {
      session = existing;
      session.level = level || session.level;
      session.code = code || session.code;
      session.challengeDescription = challengeDescription || session.challengeDescription;
      session.updatedAt = new Date().toISOString();
    }
  } else {
    session = createTutorSession({
      id: randomUUID(),
      level,
      code,
      challengeDescription,
    });
  }

  const strategy = autoSelectStrategy(answer, session.history.length, session.level);

  const historyText = session.history
    .slice(-4)
    .map((item) => `Step ${item.step}\n- Etudiant: ${item.studentAnswer}\n- IA: ${item.assistantResponse}`)
    .join('\n\n') || 'Aucun historique.';

  const system = [
    `Tu es un tuteur Python expert. Reponds uniquement en ${responseLanguage}.`,
    `Strategie active: ${strategy}.`,
    strategyRule(strategy),
    '',
    'REGLE DE LONGUEUR — tu decides toi-meme selon le contexte:',
    '- Reponse COURTE (2-4 lignes) : salutations, confirmations, erreurs simples, questions de l etudiant deja claires.',
    '- Reponse MOYENNE (1 paragraphe + code si besoin) : corrections de bugs, conseils d optimisation, explications d une notion.',
    '- Reponse DETAILLEE (plusieurs blocs) : SEULEMENT si l etudiant demande explicitement "explique en detail", "decris chaque etape", "comment ca fonctionne" ou si le probleme est complexe et necessite plusieurs etapes.',
    'Ne jamais etre verbeux par defaut. Aller droit au but.',
    '',
    'REGLE CODE:',
    'Quand tu proposes du code, fournis-le dans un bloc ```python ... ``` COMPLET (pas de "..." ni de troncature).',
    'L etudiant peut cliquer "Remplacer dans l editeur" directement sous le bloc.',
    '',
    'Ton : direct, confiant, pedagogique. Pas de phrases inutiles comme "Bien sur !" ou "Excellente question !".',
  ].join('\n');

  const user = [
    `Niveau: ${session.level}`,
    session.challengeDescription ? `Contexte exercice: ${session.challengeDescription}` : '',
    session.code ? `Code actuel de l etudiant dans l editeur:\n\`\`\`python\n${session.code}\n\`\`\`` : 'Code non fourni.',
    consoleOutput ? `Sortie terminal (derniere execution):\n${consoleOutput.slice(0, 800)}` : '',
    `Historique recents:\n${historyText}`,
    '',
    answer ? `Message etudiant: ${answer}` : 'Debut de session: analyse le code present dans l editeur, identifie les points forts et les axes d amelioration, puis pose une question pour guider l etudiant.',
  ].filter(Boolean).join('\n\n');

  try {
    const response = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      maxTokens: 1400,
    });

    const item = {
      step: session.history.length,
      studentAnswer: answer,
      assistantResponse: response,
      tutorStrategy: strategy,
      createdAt: new Date().toISOString(),
    };

    session.history.push(item);
    session.updatedAt = new Date().toISOString();
    saveTutorSession(session);

    return Response.json({
      prompt_version: 'nextjs-v1-adaptive-tutor',
      session_id: session.id,
      step: session.history.length,
      response,
      tutor_strategy: strategy,
      history: session.history,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'OpenAI indisponible';
    return Response.json({ detail }, { status: 502 });
  }
}
