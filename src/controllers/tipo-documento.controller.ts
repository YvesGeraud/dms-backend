import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { TipoDocumentoService } from "@/services/tipo-documento.service";
import {
  enviarRespuestaExitosa,
  enviarRecursoCreado,
  enviarSinContenido,
} from "@/utils/respuestas.utils";
import { ErrorValidacion } from "@/utils/errores.utils";

// ============================================================
// LISTAR
// ============================================================
export const listarTiposDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pagina = parseInt(req.query.pagina as string) || 1;
    const limite = parseInt(req.query.limite as string) || 10;
    const soloActivos = req.query.soloActivos !== "false";

    const resultado = await TipoDocumentoService.listar({
      pagina,
      limite,
      soloActivos,
    });

    enviarRespuestaExitosa(
      res,
      resultado.datos,
      "Tipos de documento obtenidos",
      StatusCodes.OK,
      {
        paginaActual: resultado.paginaActual,
        totalPaginas: resultado.totalPaginas,
        totalRegistros: resultado.totalRegistros,
        registrosPorPagina: resultado.registrosPorPagina,
      }
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// OBTENER POR ID
// ============================================================
export const obtenerTipoDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    const tipo = await TipoDocumentoService.obtenerPorId(id);
    enviarRespuestaExitosa(res, tipo, "Tipo de documento encontrado");
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CREAR
// ============================================================
export const crearTipoDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { clave, descripcion, max_size_bytes, extensiones_permitidas } = req.body;

    if (!clave) throw new ErrorValidacion("El campo 'clave' es requerido");
    if (!descripcion) throw new ErrorValidacion("El campo 'descripcion' es requerido");
    if (!max_size_bytes) throw new ErrorValidacion("El campo 'max_size_bytes' es requerido");
    if (!Array.isArray(extensiones_permitidas) || !extensiones_permitidas.length) {
      throw new ErrorValidacion("'extensiones_permitidas' debe ser un arreglo con al menos un elemento");
    }

    // Obtener id_ct_usuario_in desde el token JWT
    const id_ct_usuario_in = req.usuario!.id;

    const tipo = await TipoDocumentoService.crear({
      clave,
      descripcion,
      max_size_bytes: Number(max_size_bytes),
      extensiones_permitidas,
      id_ct_usuario_in,
    });

    enviarRecursoCreado(res, tipo, "Tipo de documento creado exitosamente");
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ACTUALIZAR
// ============================================================
export const actualizarTipoDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    const { clave, descripcion, max_size_bytes, extensiones_permitidas } = req.body;

    // Obtener id_ct_usuario_up desde el token JWT
    const id_ct_usuario_up = req.usuario!.id;

    const tipo = await TipoDocumentoService.actualizar(id, {
      clave,
      descripcion,
      max_size_bytes: max_size_bytes !== undefined ? Number(max_size_bytes) : undefined,
      extensiones_permitidas,
      id_ct_usuario_up,
    });

    enviarRespuestaExitosa(res, tipo, "Tipo de documento actualizado exitosamente");
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DESACTIVAR (soft delete)
// ============================================================
export const desactivarTipoDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    // Obtener idUsuario desde el token JWT
    const idUsuario = req.usuario!.id;

    await TipoDocumentoService.desactivar(id, idUsuario);
    enviarSinContenido(res);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ACTIVAR
// ============================================================
export const activarTipoDocumento = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) throw new ErrorValidacion("El id debe ser un número válido");

    // Obtener idUsuario desde el token JWT
    const idUsuario = req.usuario!.id;

    const tipo = await TipoDocumentoService.activar(id, idUsuario);
    enviarRespuestaExitosa(res, tipo, "Tipo de documento activado exitosamente");
  } catch (error) {
    next(error);
  }
};
