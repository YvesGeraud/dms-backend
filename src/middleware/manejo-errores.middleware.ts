import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ErrorBase, esErrorOperacional } from "../utils/errores.utils";
import { enviarRespuestaError } from "../utils/respuestas.utils";
import logger from "../config/logger.config";
import configuracionServidor from "../config/servidor.config";

/**
 * Middleware para manejar errores de manera centralizada
 */
export const manejarErrores = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Logging del error
  logger.error("Error capturado:", {
    mensaje: error.message,
    stack: error.stack,
    url: req.originalUrl,
    metodo: req.method,
    ip: req.ip,
  });

  // Si ya se envió la respuesta, pasar al siguiente middleware
  if (res.headersSent) {
    return next(error);
  }

  // Error personalizado (ErrorBase)
  if (error instanceof ErrorBase) {
    enviarRespuestaError(
      res,
      error.message,
      error.codigoHttp,
      undefined,
      configuracionServidor.estaEnDesarrollo() ? error.stack : undefined
    );
    return;
  }

  // Error genérico
  const codigoHttp = StatusCodes.INTERNAL_SERVER_ERROR;
  const mensaje = configuracionServidor.estaEnProduccion()
    ? "Error interno del servidor"
    : error.message;

  enviarRespuestaError(
    res,
    mensaje,
    codigoHttp,
    undefined,
    configuracionServidor.estaEnDesarrollo() ? error.stack : undefined
  );

  // Si no es operacional, considerar cerrar el servidor
  if (!esErrorOperacional(error)) {
    logger.error(
      "Error crítico no operacional detectado. Considerar reiniciar el servidor."
    );
  }
};

/**
 * Middleware para manejar rutas no encontradas (404)
 */
export const manejarRutaNoEncontrada = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  enviarRespuestaError(
    res,
    `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    StatusCodes.NOT_FOUND
  );
};