import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export type UserRole = 'USER' | 'CREATOR' | 'ADMIN';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      emailVerified: string | null;
    };
  }
  interface User {
    role: UserRole;
    emailVerified: string | null;
  }
  interface JWT {
    id: string;
    role: UserRole;
    emailVerified: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        if (!user.password) return null;
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          emailVerified: user.emailVerified?.toISOString() ?? null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.emailVerified = user.emailVerified ?? null;
      }
      // Sessions are stateless: refresh the flags worth trusting from the DB
      // when the client calls useSession().update().
      if (trigger === 'update' && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, emailVerified: true },
        });
        if (fresh) {
          token.role = fresh.role as UserRole;
          token.emailVerified = fresh.emailVerified?.toISOString() ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.emailVerified = (token.emailVerified as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
