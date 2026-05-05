import { callOpenAI, parseJsonFromText } from '@/lib/generator-ai/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChallengeRequest = {
  level?: string;
  language?: string;
  challenge_topic?: string;
  course_description?: string;
  pedagogy_context?: Record<string, unknown>;
};

type ChallengeResponse = {
  challenge: string;
  challenge_json: {
    enonce: string;
    contraintes: string[];
    hints: string[];
    exemple: string;
    starter_code: string;
  };
  starter_code: string;
  challenge_tests: {
    mode: 'function';
    function_name: string;
    test_cases: Array<{
      name: string;
      args_literal: string;
      expected_literal: string;
      constraint?: string;
    }>;
    quality_checks: string[];
  };
};

const DEFAULT_STARTER = [
  'def solution(*args):',
  '    """Complete la logique ici."""',
  '    pass',
].join('\n');

export async function POST(req: Request) {
  let body: ChallengeRequest;
  try {
    body = (await req.json()) as ChallengeRequest;
  } catch {
    return Response.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const level = String(body.level || 'intermediaire');
  const language = String(body.language || 'Python');
  const topic = String(body.challenge_topic || 'Mini challenge Python').trim();
  const description = String(body.course_description || '').trim();
  const responseLanguage = String(body.pedagogy_context?.responseLanguage || 'francais simple');

  const system = [
    `Tu es un concepteur d exercices ${language} expert et pedagogique. Reponds uniquement en ${responseLanguage}.`,
    '',
    'Ton objectif: produire un mini-challenge de qualite professionnelle — clair, progressif, motivant et testable.',
    '',
    'REGLES OBLIGATOIRES:',
    '1) enonce: ecrit en francais clair, 3 a 5 phrases max. Contexte concret (ex: un calcul, une transformation, un jeu). Precise exactement ce qu on attend en entree et en sortie.',
    '2) contraintes: 3 a 5 contraintes techniques pertinentes au niveau. Ex: "Utiliser une boucle for", "Gerer les entrees negatives", "Retourner None si invalide".',
    '3) hints: 2 a 3 indices progressifs — du plus general au plus precis. N explique pas la solution, guide la reflexion.',
    '4) exemple: un exemple concret input/output illustrant le comportement attendu. Format: input: ... → output: ...',
    '5) starter_code: template Python PROPRE avec la bonne signature de fonction. Docstring d une ligne. Corps avec "pass" ou commentaire guide. PAS de solution dedans.',
    '6) challenge_tests: au moins 5 test_cases couvrant: cas nominal, cas limite (0, vide, None, negatif), cas typique, cas avance si pertinent. args_literal et expected_literal doivent etre valides en Python.',
    '7) function_name: nom explicite snake_case correspondant a l enonce (ex: calculer_moyenne, filtrer_pairs, trouver_maximum).',
    '8) quality_checks: 3 criteres de qualite pertinents pour ce challenge specifique.',
    '',
    'Retourne uniquement un JSON valide, sans texte autour.',
  ].join('\n');

  const user = [
    `Niveau: ${level}`,
    `Sujet: ${topic}`,
    description ? `Description de cours fournie par l etudiant: "${description}"` : '',
    '',
    'Genere un exercice Python qui:',
    '- correspond exactement au niveau et au sujet',
    '- est concret et motivant (probleme du monde reel quand c est possible)',
    '- est faisable en 10 a 20 minutes',
    '- peut etre evalue de maniere automatique via des tests unitaires',
    '',
    'Format JSON attendu:',
    '{',
    '  "challenge": "Description complete lisible pour l etudiant",',
    '  "challenge_json": {',
    '    "enonce": "Enonce clair et precis (3-5 phrases)",',
    '    "contraintes": ["contrainte 1", "contrainte 2", "..."],',
    '    "hints": ["Indice general", "Indice plus precis", "..."],',
    '    "exemple": "input: ... → output: ...",',
    '    "starter_code": "def nom_fonction(...):\\n    \\\"\\\"\\\"Une ligne.\\\"\\\"\\\"\\n    pass"',
    '  },',
    '  "starter_code": "def nom_fonction(...):\\n    \\\"\\\"\\\"Une ligne.\\\"\\\"\\\"\\n    pass",',
    '  "challenge_tests": {',
    '    "mode": "function",',
    '    "function_name": "nom_fonction",',
    '    "test_cases": [',
    '      {"name": "cas_nominal", "args_literal": "[valeur]", "expected_literal": "valeur_attendue"},',
    '      {"name": "cas_limite", "args_literal": "[0]", "expected_literal": "valeur_attendue"},',
    '      {"name": "cas_negatif", "args_literal": "[-1]", "expected_literal": "valeur_attendue"},',
    '      {"name": "cas_typique", "args_literal": "[5, 3]", "expected_literal": "valeur_attendue"},',
    '      {"name": "cas_avance", "args_literal": "[...]", "expected_literal": "valeur_attendue"}',
    '    ],',
    '    "quality_checks": ["critere 1", "critere 2", "critere 3"]',
    '  }',
    '}',
  ].filter(Boolean).join('\n');

  try {
    const raw = await callOpenAI({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      maxTokens: 2800,
    });

    const parsed = parseJsonFromText<Partial<ChallengeResponse>>(raw);
    const starter = String(parsed?.starter_code || parsed?.challenge_json?.starter_code || DEFAULT_STARTER).trim() || DEFAULT_STARTER;
    const challenge = String(parsed?.challenge || parsed?.challenge_json?.enonce || `Exercice: ${topic}`).trim();

    const response: ChallengeResponse = {
      challenge,
      challenge_json: {
        enonce: String(parsed?.challenge_json?.enonce || challenge).trim(),
        contraintes: Array.isArray(parsed?.challenge_json?.contraintes)
          ? parsed!.challenge_json!.contraintes.map((item) => String(item)).filter(Boolean)
          : ['Ecrire une fonction correcte et lisible.'],
        hints: Array.isArray(parsed?.challenge_json?.hints)
          ? parsed!.challenge_json!.hints.map((item) => String(item)).filter(Boolean)
          : ['Commence par des cas simples puis generalise.'],
        exemple: String(parsed?.challenge_json?.exemple || '').trim(),
        starter_code: starter,
      },
      starter_code: starter,
      challenge_tests: {
        mode: 'function',
        function_name: String(parsed?.challenge_tests?.function_name || 'solution').trim() || 'solution',
        test_cases: Array.isArray(parsed?.challenge_tests?.test_cases) && parsed!.challenge_tests!.test_cases.length > 0
          ? parsed!.challenge_tests!.test_cases.map((test, index) => ({
              name: String(test.name || `test_${index + 1}`).trim() || `test_${index + 1}`,
              args_literal: String(test.args_literal || '[]').trim() || '[]',
              expected_literal: String(test.expected_literal || 'None').trim() || 'None',
              constraint: String(test.constraint || '').trim() || undefined,
            }))
          : [
              { name: 'cas_simple', args_literal: '[1]', expected_literal: '1' },
              { name: 'cas_zero', args_literal: '[0]', expected_literal: '0' },
              { name: 'cas_negatif', args_literal: '[-1]', expected_literal: '-1' },
              { name: 'cas_typique', args_literal: '[5]', expected_literal: '5' },
            ],
        quality_checks: Array.isArray(parsed?.challenge_tests?.quality_checks)
          ? parsed!.challenge_tests!.quality_checks.map((item) => String(item)).filter(Boolean)
          : ['Nomme bien la fonction', 'Couvre les cas limites', 'Code lisible'],
      },
    };

    return Response.json(response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'OpenAI indisponible';
    return Response.json({ detail }, { status: 502 });
  }
}
