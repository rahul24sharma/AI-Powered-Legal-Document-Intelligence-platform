import { PrismaClient } from '@prisma/client';

declare global {
  // Reuse Prisma across hot reloads in development.
  // eslint-disable-next-line no-var
  var __legalPlatformPrisma__: PrismaClient | undefined;
}

/** Return a shared Prisma client instead of opening new connections per module. */
export const prisma =
  globalThis.__legalPlatformPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__legalPlatformPrisma__ = prisma;
}
