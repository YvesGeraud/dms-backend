import { StatusCodes } from 'http-status-codes';
import type { ErrorCampo } from '@/utils/respuestas.utils';

// ── Códigos de error internos ─────────────────────────────────────────────────

export type CodigoError =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'INTERNAL_ERROR';

// ── Clase base ────────────────────────────────────────────────────────────────

/**
 * Error operacional controlado. Cualquier error que lances con throw debe
 * extender esta clase para que el error middleware lo maneje con gracia.
 *
 * Errores que NO extienden AppError son considerados bugs inesperados
 * y se registran en el log con toda la información.
 */
export class AppError extends Error {
  constructor(
    public readonly mensaje: string,
    public readonly statusCode: number,
    public readonly codigo: CodigoError,
    public readonly errores?: ErrorCampo[],
  ) {
    super(mensaje);
    this.name = this.constructor.name;
    // Preserva el stack trace correcto en V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Errores específicos ───────────────────────────────────────────────────────

/** 404 — El recurso pedido no existe */
export class ErrorNoEncontrado extends AppError {
  constructor(recurso = 'Recurso') {
    super(`${recurso} no encontrado`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }
}

/** 400 — Los datos enviados no pasan validación (campos inválidos) */
export class ErrorValidacion extends AppError {
  constructor(mensaje: string, errores?: ErrorCampo[]) {
    super(mensaje, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', errores);
  }
}

/** 400 — Petición mal formada en general */
export class ErrorMalFormado extends AppError {
  constructor(mensaje: string) {
    super(mensaje, StatusCodes.BAD_REQUEST, 'BAD_REQUEST');
  }
}

/** 401 — No autenticado (sin token o token inválido) */
export class ErrorNoAutenticado extends AppError {
  constructor(mensaje = 'No autenticado') {
    super(mensaje, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

/** 403 — Autenticado pero sin permisos suficientes */
export class ErrorNoAutorizado extends AppError {
  constructor(mensaje = 'No tienes permisos para realizar esta acción') {
    super(mensaje, StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
}

/** 409 — Conflicto: ya existe un recurso con esos datos únicos */
export class ErrorDuplicado extends AppError {
  constructor(mensaje: string) {
    super(mensaje, StatusCodes.CONFLICT, 'CONFLICT');
  }
}

/**
 * 422 — Regla de negocio violada.
 * Para cuando los datos son válidos pero la operación no está permitida.
 * Ej: "No se puede cancelar una orden ya entregada", "Saldo insuficiente"
 */
export class ErrorNegocio extends AppError {
  constructor(mensaje: string) {
    super(mensaje, StatusCodes.UNPROCESSABLE_ENTITY, 'BUSINESS_RULE');
  }
}
