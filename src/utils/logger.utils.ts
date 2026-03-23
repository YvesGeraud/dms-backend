import path from 'path';
import fs from 'fs';
import winston from 'winston';
import { config } from '@/config/servidor.config';

const { combine, timestamp, errors, colorize, printf, json } = winston.format;

// Colores por nivel — sobreescribe los defaults de Winston para mejor visibilidad
winston.addColors({
  error: 'bold red',
  warn: 'bold yellow',
  info: 'bold cyan',
  http: 'magenta',
  debug: 'gray',
});

// ── Directorio de logs ────────────────────────────────────────────────────────

const LOGS_DIR = path.resolve('logs');

// Se crea el directorio al arrancar — no falla si ya existe
if (config.esProduccion) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// ── Formatos ──────────────────────────────────────────────────────────────────

/**
 * Consola en desarrollo: coloreado y legible.
 * Ejemplo: 14:32:05 [error] Credenciales inválidas {"id_usuario":3}
 */
const formatoConsolaDesarrollo = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return stack
      ? `${timestamp} [${level}] ${message}${extras}\n${stack}`
      : `${timestamp} [${level}] ${message}${extras}`;
  }),
);

/**
 * JSON estructurado: para consola en producción y para todos los archivos.
 * Compatible con ELK Stack, Datadog, GCP Logging, etc.
 * No usa colorize — los códigos ANSI se ven mal en archivos y en algunos agregadores.
 */
const formatoJSON = combine(timestamp(), errors({ stack: true }), json());

// ── Transportes ───────────────────────────────────────────────────────────────

const transportes: winston.transport[] = [
  new winston.transports.Console({
    // En producción: JSON en consola para que Docker/PM2/systemd lo capten bien.
    // En desarrollo: formato legible con colores.
    format: config.esProduccion ? formatoJSON : formatoConsolaDesarrollo,
  }),
];

//if (config.esProduccion) {
/**
 * Solo errores — archivo pequeño, el primero que se revisa cuando algo falla.
 * Rotación: 10 MB por archivo, máximo 30 archivos (≈ un mes de errores diarios).
 * tailable: true → el archivo activo siempre se llama error.log (sin sufijo numérico).
 */
transportes.push(
  new winston.transports.File({
    filename: path.join(LOGS_DIR, 'error.log'),
    level: 'error',
    format: formatoJSON,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 30,
    tailable: true,
  }),
);

/**
 * Todos los niveles — historial completo para auditoría y troubleshooting.
 * Rotación: 50 MB por archivo, máximo 7 archivos rotados.
 */
transportes.push(
  new winston.transports.File({
    filename: path.join(LOGS_DIR, 'combined.log'),
    format: formatoJSON,
    maxsize: 50 * 1024 * 1024,
    maxFiles: 7,
    tailable: true,
  }),
);
//}

// ── Logger principal ──────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  // Producción: 'info' y superior | Desarrollo: también 'debug' y 'http'
  level: config.esProduccion ? 'info' : 'debug',
  transports: transportes,
  // Las excepciones no capturadas las manejamos en server.ts para poder
  // hacer shutdown limpio antes de salir
  exitOnError: false,
});

// ── Stream para Morgan ────────────────────────────────────────────────────────

/**
 * Morgan escribe en este stream para que los logs HTTP pasen por Winston
 * y queden registrados en los mismos archivos que el resto de la aplicación.
 */
export const morganStream: { write: (message: string) => void } = {
  write: (message) => logger.http(message.trim()),
};
