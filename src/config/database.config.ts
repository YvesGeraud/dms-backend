import { PrismaClient } from "@/generated/prisma/client";
import { crearAdapterPrisma } from "./prisma-adapter";

declare global {
  var prisma: PrismaClient | undefined;
}

class DatabaseConfig {
  private static instancia: PrismaClient;

  private constructor() {}

  public static obtenerInstancia(): PrismaClient {
    if (!DatabaseConfig.instancia) {
      // Tomamos siempre DATABASE_URL como prioridad (usado en los otros sistemas)
      const databaseUrl = process.env.DATABASE_URL || "";
      
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
