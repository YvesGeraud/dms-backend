import { PrismaClient } from '@/generated/prisma/client';
import { config } from '@/config/servidor.config';

declare global {
  var prisma: PrismaClient | undefined;
}

function crearCliente(): PrismaClient {
  process.env.DATABASE_URL = config.db.url;
  // @ts-ignore: Tipos de Prisma generados con features incompatibles, ignorando validación de TypeScript
  return new PrismaClient({
    log: config.nodeEnv === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalThis.prisma ?? crearCliente();

if (!config.esProduccion) {
  globalThis.prisma = prisma;
}
