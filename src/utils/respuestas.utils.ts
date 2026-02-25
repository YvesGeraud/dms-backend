import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { RespuestaApi, MetaRespuesta } from "@/types";
import configuracionServidor from "@/config/servidor.config";

/**
 * Enviar respuesta exitosa estandarizada
 */
export const enviarRespuestaExitosa = <T>(
  res: Response,
  datos?: T,
  mensaje: string = "Operación exitosa",
  codigoHttp: number = StatusCodes.OK,
  meta?: MetaRespuesta
): Response => {
  const respuesta: RespuestaApi<T> = {
    exito: true,
    mensaje,
    datos,
    meta,
  };

  return res.status(codigoHttp).json(respuesta);
};

/**
 * Enviar respuesta de error estandarizada
 */
export const enviarRespuestaError = (
  res: Response,
  mensaje: string = "Error en la operación",
  codigoHttp: number = StatusCodes.INTERNAL_SERVER_ERROR,
  errores?: any[],
  stack?: string
): Response => {
  const respuesta: any = {
    exito: false,
    mensaje,
    errores,
  };

  // Incluir stack solo en desarrollo
  if (!configuracionServidor.estaEnProduccion() && stack) {
    respuesta.stack = stack;
  }

  return res.status(codigoHttp).json(respuesta);
};

/**
 * Respuesta de recurso creado (201)
 */
export const enviarRecursoCreado = <T>(
  res: Response,
  datos: T,
  mensaje: string = "Recurso creado exitosamente"
): Response => {
  return enviarRespuestaExitosa(res, datos, mensaje, StatusCodes.CREATED);
};

/**
 * Respuesta sin contenido (204)
 */
export const enviarSinContenido = (res: Response): Response => {
  return res.status(StatusCodes.NO_CONTENT).send();
};