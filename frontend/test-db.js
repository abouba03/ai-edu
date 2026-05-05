const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteWithRetry(clerkId, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await prisma.exerciseSession.delete({ where: { clerkId } });
      return true;
    } catch (e) {
      if (i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
  return false;
}

async function test() {
  try {
    const marker = `local-test-${Date.now()}`;

    const created = await prisma.exerciseSession.create({
      data: {
        clerkId: marker,
      },
    });
    console.log('CREATE_OK:', created.id);

    const found = await prisma.exerciseSession.findUnique({
      where: { clerkId: marker },
      select: { id: true, clerkId: true, totalPoints: true },
    });
    console.log('READ_OK:', JSON.stringify(found));

    await deleteWithRetry(marker);
    console.log('DELETE_OK');
  } catch(e) {
    console.log('ERREUR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
