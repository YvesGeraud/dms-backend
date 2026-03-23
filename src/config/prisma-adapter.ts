import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function crearAdapterPrisma(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada en .env o el entorno");
  }

  const url = new URL(databaseUrl);

  const poolConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
  };

  return new PrismaMariaDb(poolConfig);
}
