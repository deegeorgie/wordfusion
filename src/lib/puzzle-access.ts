import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/** Return a public puzzle, or a draft only to its creator/admin. */
export async function getAccessiblePuzzle(id: string) {
  const puzzle = await db.crosswordPuzzle.findUnique({ where: { id } });
  if (!puzzle || puzzle.published) return puzzle;

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === 'ADMIN';
  const isOwner = session?.user.id === puzzle.creatorId;
  return isAdmin || isOwner ? puzzle : null;
}
