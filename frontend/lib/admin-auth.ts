import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';

export type AdminContext = {
  ok: boolean;
  status: number;
  clerkId?: string;
  userId?: string | null;
  reason?: string;
};

export async function getAdminContext(): Promise<AdminContext> {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  if (isAuthDisabled) {
    return {
      ok: true,
      status: 200,
      clerkId: 'local',
      userId: null,
    };
  }

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return {
      ok: false,
      status: 401,
      reason: 'unauthorized',
    };
  }

  const allowedIds = (process.env.ADMIN_CLERK_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedEmails = (process.env.ADMIN_EMAILS ?? 'abouba1703@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  let currentEmail: string | null = null;
  try {
    const clerkUser = await currentUser();
    currentEmail =
      clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase() ??
      clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ??
      null;
  } catch {
    currentEmail = null;
  }

  const hasAdminRestrictions = allowedIds.length > 0 || allowedEmails.length > 0;
  const idAllowed = allowedIds.includes(clerkId);
  const emailAllowed = currentEmail ? allowedEmails.includes(currentEmail) : false;

  if (hasAdminRestrictions && !idAllowed && !emailAllowed) {
    return {
      ok: false,
      status: 403,
      reason: 'forbidden',
    };
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkId } });

    return {
      ok: true,
      status: 200,
      clerkId,
      userId: user?.id ?? null,
    };
  } catch {
    return {
      ok: true,
      status: 200,
      clerkId,
      userId: null,
    };
  }
}
