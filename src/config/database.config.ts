import { PrismaClient } from '@/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from '@/config/servidor.config';

declare global {
  var prisma: PrismaClient | undefined;
}

function crearCliente(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: config.db.host,
    port: config.db.port,
    database: config.db.nombre,
    user: config.db.usuario,
    password: config.db.password,
    connectionLimit: 5,
  });

  return new PrismaClient({
    adapter,
    log: config.nodeEnv === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalThis.prisma ?? crearCliente();

if (!config.esProduccion) {
  globalThis.prisma = prisma;
}
