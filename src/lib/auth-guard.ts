import { getServerSession } from 'next-auth';
import { authOptions, type UserRole } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Require authentication. Returns the session or a 401 response.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

/**
 * Require a minimum role. Returns the session or an error response.
 * Role hierarchy: USER < CREATOR < ADMIN
 */
export async function requireRole(minRole: UserRole) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };

  const hierarchy: Record<UserRole, number> = { USER: 1, CREATOR: 2, ADMIN: 3 };
  const userLevel = hierarchy[session!.user.role] ?? 0;
  const requiredLevel = hierarchy[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json(
        { error: 'Permissions insuffisantes' },
        { status: 403 },
      ),
      session: null,
    };
  }

  return { error: null, session };
}
