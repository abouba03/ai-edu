const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const eventCount = await prisma.learningEvent.count();
  const quizCount = await prisma.courseQuizAttempt.count();
  const challengeCount = await prisma.courseChallengeAttempt.count();
  const reflectionCount = await prisma.courseReflection.count();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      clerkId: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  });

  const recentEvents = await prisma.learningEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      action: true,
      feature: true,
      status: true,
      clerkId: true,
      userId: true,
      createdAt: true,
    },
  });

  const recentQuiz = await prisma.courseQuizAttempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      courseSlug: true,
      score: true,
      totalQuestions: true,
      passed: true,
      clerkId: true,
      userId: true,
      createdAt: true,
    },
  });

  const recentChallenges = await prisma.courseChallengeAttempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      courseSlug: true,
      status: true,
      clerkId: true,
      userId: true,
      createdAt: true,
    },
  });

  const recentReflections = await prisma.courseReflection.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      courseSlug: true,
      understood: true,
      unclear: true,
      clerkId: true,
      userId: true,
      createdAt: true,
    },
  });

  const orphanQuiz = await prisma.courseQuizAttempt.count({ where: { userId: null } });
  const orphanChallenges = await prisma.courseChallengeAttempt.count({ where: { userId: null } });
  const orphanReflections = await prisma.courseReflection.count({ where: { userId: null } });

  const localEvents = await prisma.learningEvent.count({ where: { clerkId: 'local' } });
  const localQuiz = await prisma.courseQuizAttempt.count({ where: { clerkId: 'local' } });
  const localChallenges = await prisma.courseChallengeAttempt.count({ where: { clerkId: 'local' } });
  const localReflections = await prisma.courseReflection.count({ where: { clerkId: 'local' } });

  const report = {
    counts: {
      user: userCount,
      learningEvent: eventCount,
      courseQuizAttempt: quizCount,
      courseChallengeAttempt: challengeCount,
      courseReflection: reflectionCount,
    },
    integrity: {
      rowsWithNullUserId: {
        courseQuizAttempt: orphanQuiz,
        courseChallengeAttempt: orphanChallenges,
        courseReflection: orphanReflections,
      },
      rowsWithLocalClerkId: {
        learningEvent: localEvents,
        courseQuizAttempt: localQuiz,
        courseChallengeAttempt: localChallenges,
        courseReflection: localReflections,
      },
    },
    samples: {
      users,
      recentEvents,
      recentQuiz,
      recentChallenges,
      recentReflections,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('INSPECT_ERROR', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
