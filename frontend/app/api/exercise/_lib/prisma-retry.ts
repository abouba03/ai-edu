import { Prisma } from '@prisma/client';

const TRANSIENT_CODES = new Set(['P1001', 'P1017', 'P2024']);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientPrismaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_CODES.has(error.code);
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('max clients reached') || msg.includes('emaxconnsession') || msg.includes('server has closed the connection')) {
      return true;
    }
  }
  return false;
}

export async function withPrismaRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientPrismaError(error) || attempt === retries) {
        throw error;
      }
      await sleep(150 * (attempt + 1));
    }
  }

  throw lastError;
}
