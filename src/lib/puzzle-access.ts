import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/** Return a public puzzle, or a draft only to its creator/admin. */
export async function getAccessiblePuzzle(id: string) {
  const puzzle = await db.crosswordPuzzle.findUnique({ where: { id } });
  if (!puzzle) return null;

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === 'ADMIN';
  const isOwner = session?.user.id === puzzle.creatorId;

  if (!puzzle.published) return isAdmin || isOwner ? puzzle : null;
  if (!puzzle.isPremium || isAdmin || isOwner) return puzzle;
  if (!session?.user.id) return null;

  const unlock = await db.puzzleUnlock.findUnique({
    where: {
      userId_puzzleId: {
        userId: session.user.id,
        puzzleId: puzzle.id,
      },
    },
  });

  return unlock ? puzzle : null;
}
