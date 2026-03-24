import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Meta {
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
}

interface RespuestaExito<T> {
  exito: true;
  mensaje: string;
  datos: T;
  meta?: Meta;
}

interface RespuestaError {
  exito: false;
  mensaje: string;
  codigo: string;
  errores?: ErrorCampo[];
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Centraliza todas las respuestas HTTP del sistema.
 * Uso: responder.ok(res, datos) | responder.creado(res, nuevo) | responder.paginado(...)
 */
export const responder = {
  /** 200 — Consulta o actualización exitosa */
  ok<T>(res: Response, datos: T, mensaje = 'OK'): Response {
    const cuerpo: RespuestaExito<T> = { exito: true, mensaje, datos };
    return res.status(StatusCodes.OK).json(cuerpo);
  },

  /** 201 — Recurso creado exitosamente */
  creado<T>(res: Response, datos: T, mensaje = 'Recurso creado exitosamente'): Response {
    const cuerpo: RespuestaExito<T> = { exito: true, mensaje, datos };
    return res.status(StatusCodes.CREATED).json(cuerpo);
  },

  /** 200 — Lista paginada con meta de paginación */
  paginado<T>(res: Response, datos: T[], meta: Meta, mensaje = 'OK'): Response {
    const cuerpo: RespuestaExito<T[]> = { exito: true, mensaje, datos, meta };
    return res.status(StatusCodes.OK).json(cuerpo);
  },

  /** 204 — Eliminación exitosa (sin cuerpo) */
  sinContenido(res: Response): Response {
    return res.status(StatusCodes.NO_CONTENT).send();
  },

  /** Para uso interno del error middleware — no llamar directamente en controllers */
  _error(
    res: Response,
    statusCode: number,
    mensaje: string,
    codigo: string,
    errores?: ErrorCampo[],
  ): Response {
    const cuerpo: RespuestaError = {
      exito: false,
      mensaje,
      codigo,
      ...(errores?.length && { errores }),
    };
    return res.status(statusCode).json(cuerpo);
  },
};
