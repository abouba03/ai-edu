const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { id: true, clerkId: true },
  });

  if (users.length !== 1) {
    console.log(`SKIP_BACKFILL_USERS_COUNT=${users.length}`);
    return;
  }

  const user = users[0];

  const reflectionResult = await prisma.courseReflection.updateMany({
    where: { clerkId: 'local', userId: null },
    data: { clerkId: user.clerkId, userId: user.id },
  });

  const quizResult = await prisma.courseQuizAttempt.updateMany({
    where: { clerkId: 'local', userId: null },
    data: { clerkId: user.clerkId, userId: user.id },
  });

  const challengeResult = await prisma.courseChallengeAttempt.updateMany({
    where: { clerkId: 'local', userId: null },
    data: { clerkId: user.clerkId, userId: user.id },
  });

  console.log(`CourseReflection_UPDATED=${reflectionResult.count}`);
  console.log(`CourseQuizAttempt_UPDATED=${quizResult.count}`);
  console.log(`CourseChallengeAttempt_UPDATED=${challengeResult.count}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
