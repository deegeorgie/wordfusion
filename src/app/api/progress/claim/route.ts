import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { mergeProgress } from '@/lib/progress-merge';
import { clearProgressCookie, getAnonymousProgressUserId } from '@/lib/progress-user';

const MAX_CLAIM_ATTEMPTS = 3;

/**
 * Moves the anonymous device's progress into the signed-in account. The
 * anonymous cookie is cleared afterwards, whatever the outcome of the merge.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const anonymousUserId = getAnonymousProgressUserId(request);
    if (!anonymousUserId || anonymousUserId === session.user.id) {
      return clearProgressCookie(NextResponse.json({ claimed: 0 }));
    }

    const claimed = await claimProgress(anonymousUserId, session.user.id);
    return clearProgressCookie(NextResponse.json({ claimed }));
  } catch (error) {
    console.error('Error claiming anonymous progress:', error);
    return NextResponse.json({ error: 'Failed to claim progress' }, { status: 500 });
  }
}

async function claimProgress(anonymousUserId: string, userId: string): Promise<number> {
  for (let attempt = 1; attempt <= MAX_CLAIM_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const anonymousRows = await tx.userProgress.findMany({
          where: { userId: anonymousUserId },
        });

        let claimed = 0;
        for (const anonymousRow of anonymousRows) {
          const accountRow = await tx.userProgress.findUnique({
            where: { puzzleId_userId: { puzzleId: anonymousRow.puzzleId, userId } },
          });

          if (!accountRow) {
            await tx.userProgress.update({
              where: { id: anonymousRow.id },
              data: { userId },
            });
          } else {
            const merged = mergeProgress(accountRow, anonymousRow);
            await tx.userProgress.update({
              where: { id: accountRow.id },
              data: {
                completed: merged.completed,
                completedAt: merged.completedAt,
                timeSpent: merged.timeSpent,
                hintsUsed: merged.hintsUsed,
                progress: merged.progress,
                magicWordsClaimed: merged.magicWordsClaimed,
                revealedCells: merged.revealedCells,
              },
            });
            await tx.userProgress.delete({ where: { id: anonymousRow.id } });
          }

          claimed += 1;
        }

        return claimed;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === MAX_CLAIM_ATTEMPTS || !isSerializationFailure(error)) throw error;
    }
  }

  return 0;
}

function isSerializationFailure(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { code?: string }).code === 'P2034';
}
