import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export type UserMeta = { name: string; level: string };

export async function getMe(): Promise<UserMeta> {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  if (isAuthDisabled) {
    return { name: 'Utilisateur local', level: 'débutant' };
  }

  try {
    const { userId } = await auth();
    if (!userId) return { name: 'Étudiant', level: 'débutant' };

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { displayName: true, level: true },
    });

    return {
      name: user?.displayName?.trim() || 'Étudiant',
      level: user?.level ?? 'débutant',
    };
  } catch {
    return { name: 'Étudiant', level: 'débutant' };
  }
}
