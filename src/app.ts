import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';

import { config } from '@/config/servidor.config';
import { errorMiddleware } from '@/middlewares/error.middlewares';
//import { morganStream } from '@/utils/logger';
import { router } from '@/routes';
//import { authRouter } from '@/routes/auth.route';

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();

// ── Seguridad ─────────────────────────────────────────────────────────────────

// Cabeceras de seguridad HTTP (elimina X-Powered-By, añade CSP, etc.)
app.use(helmet());

// CORS: solo los orígenes definidos en .env pueden hacer peticiones con cookies
app.use(
  cors({
    origin: config.cors.origenes,
    credentials: true, // necesario para que el navegador envíe/reciba cookies httpOnly
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }),
);

// Rate limiting global — protege contra abuso y ataques de fuerza bruta
// Para el sistema escolar: 200 req / 15 min por IP es razonable para uso normal
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: 'draft-8', // RateLimit headers estándar (RFC)
    legacyHeaders: false,
    message: {
      exito: false,
      mensaje: 'Demasiadas peticiones desde esta IP. Intenta de nuevo en 15 minutos.',
      codigo: 'TOO_MANY_REQUESTS',
    },
  }),
);

// Rate limiting estricto para rutas de autenticación (login, refresh)
/*const limitarAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // solo 20 intentos de login por IP cada 15 min
  message: {
    exito: false,
    mensaje: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    codigo: 'TOO_MANY_REQUESTS',
  },
});*/

// ── Performance ───────────────────────────────────────────────────────────────

// Comprime respuestas con gzip (reduce ~70% el tamaño en JSON grandes)
app.use(compression());

// ── Parseo de peticiones ──────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' })); // límite para evitar payloads gigantes
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser()); // necesario para leer cookies httpOnly

// ── Logging HTTP ──────────────────────────────────────────────────────────────

// 'dev' en desarrollo: coloreado y conciso | 'combined' en prod: formato Apache (para logs)
app.use(morgan(config.esProduccion ? 'combined' : 'dev'));

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Prefijo base para todas las rutas (útil cuando el proxy no reescribe la ruta)
// local: "/" -> "/health" | servidor: "/app/dms/" -> "/app/dms/health"
const base = config.basePath.endsWith('/') ? config.basePath : `${config.basePath}/`;

// Health check — sin autenticación, útil para balanceadores de carga y monitoreo
app.get(`${base}health`, (_req, res) => {
  res.status(StatusCodes.OK).json({ estado: 'ok', entorno: config.nodeEnv });
});

// Auth con rate limiting estricto (limitarAuth) — debe montarse ANTES de /api/v1
// para que el rate limiter se aplique antes del router general
//app.use('/api/v1/auth', limitarAuth, authRouter);

// Resto de módulos centralizados en routes/index.ts
app.use(`${base}api/`, router);

// ── 404 ───────────────────────────────────────────────────────────────────────

// Captura cualquier ruta no registrada antes de llegar al error middleware
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    exito: false,
    mensaje: `Ruta ${req.method} ${req.path} no encontrada`,
    codigo: 'NOT_FOUND',
  });
});

// ── Error middleware ──────────────────────────────────────────────────────────

// SIEMPRE al final — Express lo reconoce por sus 4 parámetros (err, req, res, next)
app.use(errorMiddleware);

export default app;
