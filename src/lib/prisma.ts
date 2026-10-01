import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Optional override of Prisma's interactive-transaction timeout (default
// 5 s). Unset in production. The integration tests set it because they run
// from a developer machine against a remote database, where round trips
// alone can exceed 5 s for a multi-query transaction.
const transactionTimeoutMs = Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS) || undefined

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(transactionTimeoutMs
      ? {
          transactionOptions: {
            timeout: transactionTimeoutMs,
            maxWait: transactionTimeoutMs,
          },
        }
      : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
