import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodIssue } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { Prisma } from '@/generated/prisma/client';
import { AppError, ErrorServicioOcupado, type CodigoError } from '@/utils/errores.utils';
import { responder } from '@/utils/respuestas.utils';
import { logger } from '@/utils/logger.utils';
import { config } from '@/config/servidor.config';

// ── Traductor de errores de Prisma ────────────────────────────────────────────

/**
 * Mapea los códigos de error de Prisma a respuestas HTTP legibles.
 * Códigos completos: https://www.prisma.io/docs/reference/api-reference/error-reference
 */
function traducirErrorPrisma(err: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  mensaje: string;
  codigo: CodigoError;
} {
  switch (err.code) {
    case 'P2002': {
      const campos = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      return {
        statusCode: StatusCodes.CONFLICT,
        mensaje: `Ya existe un registro con ese valor en: ${campos}`,
        codigo: 'CONFLICT',
      };
    }
    case 'P2025':
      return {
        statusCode: StatusCodes.NOT_FOUND,
        mensaje: 'El registro que intentas modificar no existe',
        codigo: 'NOT_FOUND',
      };
    case 'P2003':
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        mensaje: 'El registro relacionado no existe (foreign key inválida)',
        codigo: 'BAD_REQUEST',
      };
    case 'P2014':
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        mensaje: 'La relación entre registros no es válida',
        codigo: 'BAD_REQUEST',
      };
    default:
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        mensaje: 'Error de base de datos',
        codigo: 'INTERNAL_ERROR',
      };
  }
}

// ── Middleware global de errores ──────────────────────────────────────────────

/**
 * Captura TODOS los errores de la aplicación en un único lugar.
 * Debe registrarse ÚLTIMO en app.ts (después de todas las rutas).
 *
 * Jerarquía de manejo:
 *   1. AppError (nuestros errores controlados)
 *   2. Prisma (errores de DB conocidos)
 *   3. Zod (errores de validación de esquemas)
 *   4. JWT (token inválido o expirado)
 *   5. Error genérico (bugs inesperados)
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1 — Servicio ocupado (semáforo lleno): añade Retry-After antes de responder
  if (err instanceof ErrorServicioOcupado) {
    res.setHeader('Retry-After', String(err.retryAfter));
    responder._error(res, StatusCodes.SERVICE_UNAVAILABLE, err.mensaje, err.codigo);
    return;
  }

  // 2 — Nuestros errores operacionales (NotFoundError, ForbiddenError, etc.)
  if (err instanceof AppError) {
    responder._error(res, err.statusCode, err.mensaje, err.codigo, err.errores);
    return;
  }

  // 2 — Errores conocidos de Prisma (constraints, foreign keys, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, mensaje, codigo } = traducirErrorPrisma(err);
    responder._error(res, statusCode, mensaje, codigo);
    return;
  }

  // 3 — Errores de validación de Zod (v4: .issues en lugar de .errors)
  if (err instanceof ZodError) {
    const errores = err.issues.map((e: ZodIssue) => ({
      campo: e.path.join('.') || 'body',
      mensaje: e.message,
    }));
    responder._error(
      res,
      StatusCodes.BAD_REQUEST,
      'Datos de entrada inválidos',
      'VALIDATION_ERROR',
      errores,
    );
    return;
  }

  // 5 — Errores de Multer (subida de archivos: tamaño, cantidad, campo inesperado)
  if (err instanceof multer.MulterError) {
    const mensajesMulter: Record<string, string> = {
      LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido',
      LIMIT_FILE_COUNT: 'Se enviaron demasiados archivos',
      LIMIT_FIELD_KEY: 'Nombre del campo demasiado largo',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado — usa el campo "archivo"',
    };
    const mensaje = mensajesMulter[err.code] ?? `Error al subir el archivo: ${err.message}`;
    responder._error(res, StatusCodes.BAD_REQUEST, mensaje, 'VALIDATION_ERROR');
    return;
  }

  // 5a — Token JWT expirado
  if (err instanceof TokenExpiredError) {
    responder._error(res, StatusCodes.UNAUTHORIZED, 'El token ha expirado', 'UNAUTHORIZED');
    return;
  }

  // 5b — Token JWT malformado o firma incorrecta
  if (err instanceof JsonWebTokenError) {
    responder._error(res, StatusCodes.UNAUTHORIZED, 'Token inválido', 'UNAUTHORIZED');
    return;
  }

  // 6 — Error inesperado (bug): loguear con detalle, nunca exponer en producción
  logger.error('Error no manejado', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    // En producción estos campos son visibles en el log pero no se envían al cliente
  });

  const mensaje = config.esProduccion
    ? 'Error interno del servidor'
    : err instanceof Error
      ? err.message
      : String(err);

  responder._error(res, StatusCodes.INTERNAL_SERVER_ERROR, mensaje, 'INTERNAL_ERROR');
}
