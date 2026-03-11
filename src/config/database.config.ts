import { PrismaClient } from "../generated/prisma/client";
import { crearAdapterPrisma } from "./prisma-adapter.config";
import logger from "./logger.config";

// Singleton de Prisma para evitar múltiples conexiones
class DatabaseConfig {
  private static instancia: PrismaClient;

  private constructor() {}

  public static obtenerInstancia(): PrismaClient {
    if (!DatabaseConfig.instancia) {
      const databaseUrl = process.env.DATABASE_URL || "";
      
      // Crear adapter usando la factory reutilizable
      const adapter = crearAdapterPrisma(databaseUrl);

      // Crear instancia de PrismaClient con el adapter
      DatabaseConfig.instancia = new PrismaClient({
        adapter,
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
      });

      // Eventos de conexión
      DatabaseConfig.instancia
        .$connect()
        .then(() => {
          logger.info("✅ Conexión a base de datos establecida");
        })
        .catch((error) => {
          logger.error("❌ Error al conectar a base de datos:", error);
          process.exit(1);
        });
    }

    return DatabaseConfig.instancia;
  }

  public static async desconectar(): Promise<void> {
    if (DatabaseConfig.instancia) {
      await DatabaseConfig.instancia.$disconnect();
      logger.info("🔌 Desconectado de base de datos");
    }
  }
}

export const prisma = DatabaseConfig.obtenerInstancia();
export default DatabaseConfig;