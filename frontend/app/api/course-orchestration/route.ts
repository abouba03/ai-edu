import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

type AdaptiveLevel = 'débutant' | 'intermédiaire' | 'avancé';

function normalizeLevel(value?: string | null): AdaptiveLevel {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('avanc')) return 'avancé';
  if (normalized.includes('interm')) return 'intermédiaire';
  return 'débutant';
}

function extractNoteOverTen(value: unknown): number | null {
  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
    if (!match) return null;
    const parsed = Number(match[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === 'object' && 'note' in value) {
    return extractNoteOverTen((value as { note?: unknown }).note);
  }

  return null;
}

async function resolveClerkId() {
  const authData = await auth();
  if (authData.userId) return authData.userId;

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
    const latestKnownUser = await prisma.user.findFirst({
      where: { clerkId: { not: '' } },
      orderBy: { createdAt: 'desc' },
      select: { clerkId: true },
    });
    return latestKnownUser?.clerkId ?? null;
  }

  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courseSlug = searchParams.get('courseSlug')?.trim();
  const requestedLevel = searchParams.get('level');

  if (!courseSlug) {
    return Response.json({ ok: false, error: 'missing_course_slug' }, { status: 400 });
  }

  const clerkId = await resolveClerkId();
  if (!clerkId || clerkId === 'local') {
    return Response.json(
      {
        ok: false,
        error: 'missing_authenticated_user',
        detail: 'Utilisateur non authentifié pour construire l’orchestration.',
      },
      { status: 401 }
    );
  }

  try {
    const [lastQuiz, challengeAttempts, lastReflection] = await Promise.all([
      prisma.courseQuizAttempt.findFirst({
        where: { clerkId, courseSlug },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.courseChallengeAttempt.findMany({
        where: { clerkId, courseSlug },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.courseReflection.findFirst({
        where: { clerkId, courseSlug },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const challengeRetries = challengeAttempts.length;
    const lastChallenge = challengeAttempts[0] ?? null;
    const challengeNote = lastChallenge ? extractNoteOverTen(lastChallenge.evaluation) : null;
    const challengeValidated = challengeNote !== null ? challengeNote >= 7 : false;

    const quizScorePercent =
      lastQuiz && lastQuiz.totalQuestions > 0
        ? Math.round((lastQuiz.score / lastQuiz.totalQuestions) * 100)
        : null;

    const reflectionUnclear = (lastReflection?.unclear || '').trim();
    const reflectionUnderstood = (lastReflection?.understood || '').trim();

    const dominantBlocker =
      reflectionUnclear.length === 0
        ? 'Aucun blocage déclaré'
        : /syntaxe|python|indent|parenth|variable/i.test(reflectionUnclear)
          ? 'Blocage syntaxe'
          : /logique|etape|raisonnement|algorith/i.test(reflectionUnclear)
            ? 'Blocage logique'
            : 'Blocage compréhension';

    let adaptiveLevel = normalizeLevel(requestedLevel);
    if (quizScorePercent !== null && quizScorePercent >= 85 && challengeValidated) {
      adaptiveLevel = adaptiveLevel === 'débutant' ? 'intermédiaire' : 'avancé';
    } else if (quizScorePercent !== null && quizScorePercent < 60) {
      adaptiveLevel = 'débutant';
    }

    if (reflectionUnclear.length > reflectionUnderstood.length + 20) {
      adaptiveLevel = adaptiveLevel === 'avancé' ? 'intermédiaire' : 'débutant';
    }

    const strictCourseValidated = Boolean(lastQuiz?.passed) && challengeValidated;

    const nextSequence: Array<{ step: string; reason: string; cta: string; href: string }> = [];

    nextSequence.push({
      step: 'Résumé vocal (2 min)',
      reason: 'Ancrer les objectifs du cours avant action.',
      cta: 'Écouter le résumé',
      href: '#before-course',
    });

    if (!lastQuiz || !lastQuiz.passed) {
      nextSequence.push({
        step: 'Checkpoint court (V/F + QCM)',
        reason: 'Valider la compréhension immédiate du bloc vidéo.',
        cta: 'Lancer checkpoint',
        href: '#checkpoint',
      });
    }

    if (!challengeValidated) {
      nextSequence.push({
        step: 'Mini challenge contextualisé',
        reason: 'Passer de la théorie à une résolution active.',
        cta: 'Ouvrir challenge',
        href: `/courses/${courseSlug}/mini-challenge`,
      });
    }

    if (dominantBlocker !== 'Aucun blocage déclaré' || (quizScorePercent !== null && quizScorePercent < 70)) {
      nextSequence.push({
        step: 'Interactive Debugger guidé',
        reason: 'Débloquer avec questionnement socratique sans correction brute.',
        cta: 'Déboguer',
        href: `/debugger?level=${encodeURIComponent(adaptiveLevel)}`,
      });
    }

    nextSequence.push({
      step: 'CodeCorrector structuré',
      reason: 'Transformer chaque erreur en action concrète.',
      cta: 'Renforcer',
      href: '/corrector',
    });

    return Response.json({
      ok: true,
      courseSlug,
      adaptiveLevel,
      strictCourseValidated,
      kpi: {
        quizScorePercent,
        challengeRetries,
        dominantBlocker,
      },
      nextSequence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database_error';
    return Response.json({ ok: false, error: 'database_unavailable', detail: message }, { status: 200 });
  }
}
