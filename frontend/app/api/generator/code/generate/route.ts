import { callOpenAI, parseJsonFromText } from '@/lib/generator-ai/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GenerateBody = {
  prompt?: string;
  pedagogy_context?: Record<string, unknown>;
};

type GenerateResponse = {
  code: string;
  explanation: string;
};

type RequirementHints = {
  wantsClasses: boolean;
  wantsCliMenu: boolean;
  wantsPersistence: boolean;
  wantsTransfer: boolean;
  wantsHistory: boolean;
};

/** Last-resort extractor: grab first ```python ... ``` or ``` ... ``` block from raw text */
function extractCodeFromRaw(raw: string): string {
  const pyFence = raw.match(/```python\s*([\s\S]*?)```/i);
  if (pyFence) return pyFence[1].trim();
  const anyFence = raw.match(/```\s*([\s\S]*?)```/);
  if (anyFence) return anyFence[1].trim();
  // If raw looks like plain Python (has def/class/import/print), return as-is
  if (/^\s*(def |class |import |from |print\(|#)/.test(raw)) return raw.trim();
  return '';
}

function buildRequirementHints(prompt: string): RequirementHints {
  const p = prompt.toLowerCase();
  return {
    wantsClasses: /\bclass|classe|objet\b/.test(p),
    wantsCliMenu: /\bmenu|cli|ligne de commande|while true|sous-menu|sous menu\b/.test(p),
    wantsPersistence: /\bjson|sauvegarde|charger_donnees|sauvegarder_donnees|persistance|fichier\b/.test(p),
    wantsTransfer: /\btransfer|virement\b/.test(p),
    wantsHistory: /\bhistorique|transaction\b/.test(p),
  };
}

function coversRequirements(code: string, hints: RequirementHints): boolean {
  const c = code.toLowerCase();
  if (hints.wantsClasses && !/\bclass\s+[a-z_]/.test(c)) return false;
  if (hints.wantsCliMenu && !(/\bwhile\s+true\b/.test(c) && /\binput\s*\(/.test(c))) return false;
  if (hints.wantsPersistence && !(/\bjson\b/.test(c) || /sauvegarder_donnees|charger_donnees/.test(c))) return false;
  if (hints.wantsTransfer && !/\btransfer/.test(c)) return false;
  if (hints.wantsHistory && !/historique|transaction/.test(c)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return Response.json({ detail: 'Prompt vide.' }, { status: 400 });
  }

  const responseLanguage = String(body.pedagogy_context?.responseLanguage || 'francais simple');
  const requirementHints = buildRequirementHints(prompt);

  const system = [
    `Tu es un expert Python. Reponds en ${responseLanguage}.`,
    '',
    'IMPORTANT: reponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou apres.',
    'Le JSON doit avoir exactement ces deux cles: "code" et "explanation".',
    'La valeur de "code" est une chaine contenant le code Python (avec \\n pour les sauts de ligne).',
    'La valeur de "explanation" est une courte chaine (2-4 phrases) expliquant la solution.',
    '',
    'REGLES ABSOLUES POUR LE CODE:',
    '- Genere UNIQUEMENT le code de la solution: fonctions, classes, variables demandees',
    '- Respecte 100% des exigences explicites de l enonce. Ne simplifie pas. Ne saute aucune etape demandee.',
    '- Si l enonce demande un menu CLI, inclure la boucle de menu complete.',
    '- Si l enonce demande persistance JSON, inclure sauvegarde + chargement.',
    '- Reprendre les noms de fonctions/methodes demandes quand ils sont explicites dans l enonce.',
    '- ZERO docstring',
    '- ZERO commentaire (sauf 1 inline si vraiment indispensable)',
    '- ZERO bloc if __name__ == "__main__"',
    '- ZERO exemple, ZERO print de demonstration',
    '- Le code se termine a la derniere ligne de la solution elle-meme',
  ].join('\n');

  const user = [
    'Genere la meilleure solution Python pour la demande suivante.',
    'Reponds UNIQUEMENT avec le JSON demande, sans markdown autour.',
    'Avant de repondre, verifie mentalement que chaque exigence de l enonce est bien couverte dans le code.',
    '',
    'DEMANDE:',
    prompt.slice(0, 7000),
  ].join('\n');

  try {
    const raw = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      maxTokens: 2200,
      timeoutMs: 45000,
    });

    // Attempt 1: proper JSON parse
    const parsed = parseJsonFromText<Partial<GenerateResponse>>(raw);
    const code = String(parsed?.code || '').trim();
    const explanation = String(parsed?.explanation || '').trim();

    if (code && coversRequirements(code, requirementHints)) {
      return Response.json({ code, explanation });
    }

    // Attempt 1b: retry with explicit coverage reminder when code is too generic.
    const coverageRetryRaw = await callOpenAI({
      messages: [
        {
          role: 'system',
          content: `${system}\n\nTu dois absolument couvrir toutes les exigences de l enonce sans en oublier une seule.`,
        },
        {
          role: 'user',
          content: `Regenere une solution COMPLETE et fidele a l enonce suivant.\n\n${prompt.slice(0, 7000)}`,
        },
      ],
      temperature: 0.05,
      maxTokens: 2400,
      timeoutMs: 45000,
    });

    const coverageParsed = parseJsonFromText<Partial<GenerateResponse>>(coverageRetryRaw);
    const coverageCode = String(coverageParsed?.code || '').trim();
    const coverageExplanation = String(coverageParsed?.explanation || '').trim();
    if (coverageCode && coversRequirements(coverageCode, requirementHints)) {
      return Response.json({ code: coverageCode, explanation: coverageExplanation });
    }

    // Attempt 2: extract code block directly from raw response
    const fallbackCode = extractCodeFromRaw(coverageRetryRaw) || extractCodeFromRaw(raw);
    if (fallbackCode && coversRequirements(fallbackCode, requirementHints)) {
      return Response.json({ code: fallbackCode, explanation: '' });
    }

    // Attempt 3: retry with a simpler, code-only prompt
    const retryRaw = await callOpenAI({
      messages: [
        { role: 'system', content: 'Tu es un expert Python. Retourne UNIQUEMENT le code Python, sans explication, sans JSON, sans markdown.' },
        { role: 'user', content: `Ecris une solution COMPLETE qui couvre toute la demande suivante:\n${prompt.slice(0, 7000)}` },
      ],
      temperature: 0.05,
      maxTokens: 2400,
      timeoutMs: 30000,
    });

    const retryCode = extractCodeFromRaw(retryRaw) || retryRaw.trim();
    if (retryCode && coversRequirements(retryCode, requirementHints)) {
      return Response.json({ code: retryCode, explanation: '' });
    }

    return Response.json({ detail: 'Le modele n a pas pu generer de code. Reformule ton enonce.' }, { status: 502 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Service IA indisponible';
    return Response.json({ detail }, { status: 502 });
  }
}
