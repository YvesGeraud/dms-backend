import { StatusCodes } from "http-status-codes";

/**
 * Clase base para errores personalizados
 */
export class ErrorBase extends Error {
  public readonly codigoHttp: number;
  public readonly esOperacional: boolean;

  constructor(mensaje: string, codigoHttp: number, esOperacional = true) {
    super(mensaje);
    this.codigoHttp = codigoHttp;
    this.esOperacional = esOperacional;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/**
 * Error de validación (400)
 */
export class ErrorValidacion extends ErrorBase {
  constructor(mensaje: string = "Error de validación") {
    super(mensaje, StatusCodes.BAD_REQUEST);
  }
}

/**
 * Error de autenticación (401)
 */
export class ErrorAutenticacion extends ErrorBase {
  constructor(mensaje: string = "No autenticado") {
    super(mensaje, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Error de autorización (403)
 */
export class ErrorAutorizacion extends ErrorBase {
  constructor(mensaje: string = "No autorizado") {
    super(mensaje, StatusCodes.FORBIDDEN);
  }
}

/**
 * Recurso no encontrado (404)
 */
export class ErrorNoEncontrado extends ErrorBase {
  constructor(mensaje: string = "Recurso no encontrado") {
    super(mensaje, StatusCodes.NOT_FOUND);
  }
}

/**
 * Error de lógica de negocio (422)
 */
export class ErrorNegocio extends ErrorBase {
  constructor(mensaje: string) {
    super(mensaje, StatusCodes.UNPROCESSABLE_ENTITY);
  }
}

/**
 * Error interno del servidor (500)
 */
export class ErrorInterno extends ErrorBase {
  constructor(
    mensaje: string = "Error interno del servidor",
    esOperacional = false
  ) {
    super(mensaje, StatusCodes.INTERNAL_SERVER_ERROR, esOperacional);
  }
}

/**
 * Verificar si un error es operacional
 */
export const esErrorOperacional = (error: Error): boolean => {
  if (error instanceof ErrorBase) {
    return error.esOperacional;
  }
  return false;
};