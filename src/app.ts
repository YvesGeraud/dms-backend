import moduleAlias from "module-alias";
import path from "path";

moduleAlias.addAliases({
  "@": path.join(__dirname),
  "@/config": path.join(__dirname, "config"),
  "@/controllers": path.join(__dirname, "controllers"),
  "@/middleware": path.join(__dirname, "middleware"),
  "@/models": path.join(__dirname, "models"),
  "@/routes": path.join(__dirname, "routes"),
  "@/services": path.join(__dirname, "services"),
  "@/utils": path.join(__dirname, "utils"),
  "@/validators": path.join(__dirname, "schemas"),
  "@/types": path.join(__dirname, "types"),
  "@/generated": path.join(__dirname, "generated"),
});

import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import configuracionServidor from "./config/servidor.config";
import logger from "./config/logger.config";
import {
  manejarErrores,
  manejarRutaNoEncontrada,
} from "./middleware/manejo-errores.middleware";
import DatabaseConfig from "./config/database.config";
import tipoDocumentoRoutes from "./routes/tipo-documento.routes";
import documentoRoutes from "./routes/documento.routes";

// Crear aplicación Express
const app: Application = express();

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

// Seguridad HTTP headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: configuracionServidor.cors.origenes,
    credentials: true,
  })
);

// Parsear JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compresión de respuestas
app.use(compression());

// Logging de peticiones HTTP
if (configuracionServidor.estaEnDesarrollo()) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting (limitar peticiones)
const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por IP
  message: "Demasiadas peticiones desde esta IP, intente más tarde",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiteGeneral);

// ============================================
// RUTAS
// ============================================

// Ruta de salud (health check)
app.get("/health", (req, res) => {
  res.json({
    exito: true,
    mensaje: "Servidor funcionando correctamente",
    datos: {
      entorno: configuracionServidor.entorno,
      timestamp: new Date().toISOString(),
    },
  });
});

// Rutas de la API
app.use("/api/ct_tipo_documento", tipoDocumentoRoutes);
app.use("/api/dt_documento", documentoRoutes);


// ============================================
// MANEJO DE ERRORES
// ============================================

// Ruta no encontrada (404)
app.use(manejarRutaNoEncontrada);

// Manejador global de errores
app.use(manejarErrores);

// ============================================
// INICIAR SERVIDOR
// ============================================

const iniciarServidor = async (): Promise<void> => {
  try {
    // Verificar conexión a base de datos
    await DatabaseConfig.obtenerInstancia().$connect();

    // Iniciar servidor
    app.listen(configuracionServidor.puerto, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🍽️  SISTEMA DE GESTIÓN DOCUMENTAL - API REST                       ║
║                                                                ║
║   🚀 Servidor: http://localhost:${
        configuracionServidor.puerto
      }                       ║
║   🌍 Entorno: ${configuracionServidor.entorno.toUpperCase()}                                    ║
║   📅 Fecha: ${new Date().toLocaleString("es-MX")}              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error("❌ Error al iniciar servidor:", error);
    process.exit(1);
  }
};

// Manejar cierre graceful
process.on("SIGTERM", async () => {
  logger.info("⚠️  SIGTERM recibido. Cerrando servidor...");
  await DatabaseConfig.desconectar();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("⚠️  SIGINT recibido. Cerrando servidor...");
  await DatabaseConfig.desconectar();
  process.exit(0);
});

// Iniciar
iniciarServidor();

export default app;