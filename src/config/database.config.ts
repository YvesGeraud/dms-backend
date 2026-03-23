import { PrismaClient } from "@/generated/prisma/client";
import { crearAdapterPrisma } from "./prisma-adapter";
import { config } from '@/config/servidor.config';

declare global {
  var prisma: PrismaClient | undefined;
}

class DatabaseConfig {
  private static instancia: PrismaClient;

  private constructor() {}

  public static obtenerInstancia(): PrismaClient {
    if (!DatabaseConfig.instancia) {
      // Tomamos la URL ya sintetizada de servidor.config.ts para que no lance error si falta en el .env
      const databaseUrl = config.db.url;
      
      const adapter = crearAdapterPrisma(databaseUrl);

      DatabaseConfig.instancia = new PrismaClient({
        adapter,
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
      });

      DatabaseConfig.instancia
        .$connect()
        .then(() => {
          console.log("✅ Conexión a base de datos establecida");
        })
        .catch((error) => {
          console.error("❌ Error al conectar a base de datos:", error.message);
        });
    }

    return DatabaseConfig.instancia;
  }

  public static async desconectar(): Promise<void> {
    if (DatabaseConfig.instancia) {
      await DatabaseConfig.instancia.$disconnect();
      console.log("🔌 Desconectado de base de datos");
    }
  }
}

export const prisma = globalThis.prisma ?? DatabaseConfig.obtenerInstancia();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
