import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

/**
 * Allocate a number while holding a transaction-scoped PostgreSQL advisory
 * lock. This prevents concurrent creates from selecting the same MAX + 1.
 */
export async function createWithNextPuzzleNumber<T>(
  create: (tx: Prisma.TransactionClient, puzzleNumber: number) => Promise<T>,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(49281723)`;
    const max = await tx.crosswordPuzzle.aggregate({ _max: { puzzleNumber: true } });
    return create(tx, (max._max.puzzleNumber ?? 0) + 1);
  });
}
