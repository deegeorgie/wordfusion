import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Reuse the client during local hot reloads. In serverless production each
// invocation may create its own client; the external PostgreSQL database is
// the persistent state.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
