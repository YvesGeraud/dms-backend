import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Factory para crear el adapter de Prisma con configuración de pool
 * Reutilizable en toda la aplicación (app, seeds, tests, etc.)
 */
export function crearAdapterPrisma(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada");
  }

  const url = new URL(databaseUrl);

  const poolConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remover el '/' inicial
    connectionLimit: 5,
  };

  return new PrismaMariaDb(poolConfig);
}