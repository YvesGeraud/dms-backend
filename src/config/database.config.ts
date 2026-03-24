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
    // En producción: ajusta según (max_connections de MariaDB / nº de instancias del app) - 10 de margen
    connectionLimit: config.esProduccion ? 20 : 5,
    // Tiempo máximo para obtener conexión del pool — falla rápido bajo alta carga
    acquireTimeout: 8_000,
    // Cierra conexiones inactivas después de 10 min para liberar recursos en el servidor DB
    idleTimeout: 600_000,
    // Tiempo máximo para abrir la conexión TCP con el servidor
    connectTimeout: 5_000,
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
