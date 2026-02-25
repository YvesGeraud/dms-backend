import winston from "winston";
import path from "path";
import fs from "fs";

// Crear directorio de logs si no existe
const directorioLogs = path.join(__dirname, "../../logs");
if (!fs.existsSync(directorioLogs)) {
  fs.mkdirSync(directorioLogs, { recursive: true });
}

// Formato personalizado
const formatoPersonalizado = winston.format.printf(
  ({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  }
);

// Configuración del logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { servicio: "restaurante-api" },
  transports: [
    // Archivo para errores
    new winston.transports.File({
      filename: path.join(directorioLogs, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Archivo para todos los logs
    new winston.transports.File({
      filename: path.join(directorioLogs, "combined.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// En desarrollo, también mostrar en consola con colores
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        formatoPersonalizado
      ),
    })
  );
}

export default logger;