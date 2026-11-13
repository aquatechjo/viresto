// Limits for Prisma interactive transactions (prisma.$transaction(async tx => …)).
//
// Prisma's defaults are maxWait 2s (to get a connection) and timeout 5s (for
// the whole callback). Every query in the callback is a round trip to Neon,
// so a slow link or a cold connection can pass 5s and Prisma rolls the
// transaction back with P2028 ("Transaction already closed"). Seen on
// POST /api/cases against the dev database, 2026-11-13.
//
// Keep transactions short first (reads and checks that need no lock go
// before them); this only gives the remaining writes room.

export const WRITE_TRANSACTION = { timeout: 15_000, maxWait: 10_000 } as const;
