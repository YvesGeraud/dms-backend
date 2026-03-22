import type { Request, Response } from 'express';
import ctTipoDocumentoService from '../services/ct_tipo_documento.service.js';
import { responder } from '@/utils/respuestas.utils.js';
import type {
  CrearCtTipoDocumentoDTO,
  ActualizarCtTipoDocumentoDTO,
  FiltrosCtTipoDocumento,
  CrearCtTipoDocumentosLoteDTO,
} from '@/schemas/ct_tipo_documento.schemas.js';

/**
 * Express 5 propaga automáticamente los errores de Promises rechazadas al
 * error middleware — no se necesita try/catch en cada método.
 * Si el service lanza ErrorNoEncontrado, ErrorDuplicado, etc., llegan solos.
 */

class CtTipoDocumentoController {
  async listar(req: Request, res: Response): Promise<void> {
    // req.query ya fue validado y coercionado por validar(filtrosCtTipoDocumentoSchema)
    const { datos, ...meta } = await ctTipoDocumentoService.obtenerTodos(
      req.query as unknown as FiltrosCtTipoDocumento,
    );
    responder.paginado(res, datos, meta);
  }

  async obtenerPorId(req: Request, res: Response): Promise<void> {
    // req.params.id ya es número en runtime gracias a z.coerce.number() en el schema
    const tipoDocumento = await ctTipoDocumentoService.obtenerPorId(Number(req.params['id']));
    responder.ok(res, tipoDocumento);
  }

  async crear(req: Request, res: Response): Promise<void> {
    // req.body ya fue validado y coercionado por validar(crearCtTipoDocumentoSchema)
    const tipoDocumento = await ctTipoDocumentoService.crear(
      req.body as CrearCtTipoDocumentoDTO,
      1,
    );
    responder.creado(res, tipoDocumento, 'Tipo de documento creado exitosamente');
  }

  async actualizar(req: Request, res: Response): Promise<void> {
    // req.body ya fue validado y coercionado por validar(actualizarCtTipoDocumentoSchema)
    const tipoDocumento = await ctTipoDocumentoService.actualizar(
      Number(req.params['id']),
      req.body as ActualizarCtTipoDocumentoDTO,
      1,
    );
    responder.ok(res, tipoDocumento, 'Tipo de documento actualizado exitosamente');
  }

  async eliminar(req: Request, res: Response): Promise<void> {
    // req.params.id ya es número en runtime gracias a z.coerce.number() en el schema
    await ctTipoDocumentoService.eliminar(Number(req.params['id']));
    responder.sinContenido(res);
  }

  async crearLote(req: Request, res: Response): Promise<void> {
    // req.body ya fue validado y coercionado por validar(crearCtTipoDocumentosLoteSchema)
    const datos = req.body as CrearCtTipoDocumentosLoteDTO;
    const resultado = await ctTipoDocumentoService.crearMuchos(datos, 1);
    responder.creado(
      res,
      resultado,
      `Lote procesado ${resultado.exitosos}/${resultado.procesados} creados`,
    );
  }
}
export default new CtTipoDocumentoController();
