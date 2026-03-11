import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { DocumentoService } from "../services/documento.service";
import {
  enviarRecursoCreado,
  enviarRespuestaExitosa,
} from "../utils/respuestas.utils";
import { ErrorValidacion } from "../utils/errores.utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsearCamposRequeridos(req: import("express").Request) {
  const { body } = req;
  const id_ct_tipo_documento = Number(body["id_ct_tipo_documento"]);
  const referencia_id = Number(body["referencia_id"]);
  const modulo = String(body["modulo"] ?? "").trim();

  if (!id_ct_tipo_documento || isNaN(id_ct_tipo_documento)) {
    throw new ErrorValidacion("El campo 'id_ct_tipo_documento' es requerido y debe ser un número");
  }
  if (!modulo) {
    throw new ErrorValidacion("El campo 'modulo' es requerido");
  }
  if (!referencia_id || isNaN(referencia_id)) {
    throw new ErrorValidacion("El campo 'referencia_id' es requerido y debe ser un número");
  }

  // Obtener id_ct_usuario_in desde el token JWT
  const id_ct_usuario_in = req.usuario!.id;

  return { id_ct_tipo_documento, modulo, referencia_id, id_ct_usuario_in };
}

// ─── Controladores ────────────────────────────────────────────────────────────

/**
 * POST /api/documentos/subir
 * Body (multipart/form-data):
 *   - archivo              (file)
 *   - id_ct_tipo_documento (number)
 *   - modulo               (string)
 *   - referencia_id        (number)
 */
export const subirDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new ErrorValidacion("Se requiere el campo 'archivo' con un archivo adjunto");
    }

    const campos = parsearCamposRequeridos(req);

    const documento = await DocumentoService.subirDocumento({
      file: req.file,
      ...campos,
    });

    enviarRecursoCreado(res, documento, "Documento subido exitosamente");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/documentos/subir-varios
 * Body (multipart/form-data):
 *   - archivos[]           (files)
 *   - id_ct_tipo_documento (number)  — se aplica a todos los archivos
 *   - modulo               (string)
 *   - referencia_id        (number)
 */
export const subirDocumentos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const archivos = req.files as Express.Multer.File[] | undefined;

    if (!archivos?.length) {
      throw new ErrorValidacion("Se requiere al menos un archivo en el campo 'archivos'");
    }

    const campos = parsearCamposRequeridos(req);

    const dtos = archivos.map((file) => ({ file, ...campos }));
    const resultados = await DocumentoService.subirDocumentos(dtos);

    const exitosos = resultados.filter((r) => r.exito).length;
    const fallidos = resultados.length - exitosos;

    const mensaje =
      fallidos === 0
        ? `${exitosos} documento(s) subido(s) exitosamente`
        : `${exitosos} subido(s) correctamente, ${fallidos} con error`;

    enviarRespuestaExitosa(res, resultados, mensaje, StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
};

// ─── Ver / Descargar ──────────────────────────────────────────────────────────

/**
 * GET /api/documentos/:id/ver
 * Sirve el archivo como stream inline (para mostrarlo en el navegador).
 * No expone la ruta real del disco.
 */
export const verDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    const { stream, mimeType, nombreOriginal, tamanioBytes } =
      await DocumentoService.obtenerStreamDescarga(id);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", tamanioBytes);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(nombreOriginal)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Propagar errores del stream al manejador global de Express
    stream.on("error", (err) => next(err));

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/documentos/:id/descargar
 * Fuerza la descarga del archivo (Content-Disposition: attachment).
 * No expone la ruta real del disco.
 */
export const descargarDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    const { stream, mimeType, nombreOriginal, tamanioBytes } =
      await DocumentoService.obtenerStreamDescarga(id);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", tamanioBytes);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nombreOriginal)}"`);
    res.setHeader("Cache-Control", "private, no-cache");

    stream.on("error", (err) => next(err));

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
