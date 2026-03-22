import type { Request, Response } from 'express';
import dtDocumentoService from '@/services/dt_documento.service.js';
import { responder } from '@/utils/respuestas.utils.js';
import { ErrorNegocio } from '@/utils/errores.utils.js';
import { descargarArchivo } from '@/utils/archivo.utils.js';
import type { SubirDocumentoDTO } from '@/schemas/dt_documento.schemas.js';

/**
 * Express 5 propaga automáticamente los errores de Promises rechazadas al
 * error middleware — no se necesita try/catch en cada método.
 */

class DtDocumentoController {
  /**
   * POST /api/documento/subir
   *
   * Recibe un archivo vía multipart/form-data junto con:
   *   - id_ct_tipo_documento : number  (qué tipo de documento es)
   *   - id_ct_rupeet         : number  (a qué persona/expediente pertenece)
   *   - id_ct_modulo         : number  (en qué módulo/sistema se guarda)
   *
   * El middleware multer (memoryStorage) deja el archivo en req.file.buffer
   * antes de que llegue al controlador.
   */
  async subir(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new ErrorNegocio(
        'No se recibió ningún archivo. Envía el campo "archivo" en el formulario.',
      );
    }

    const documento = await dtDocumentoService.subirDocumento(
      req.body as SubirDocumentoDTO,
      req.file,
      1, // TODO: reemplazar con req.user.id cuando se integre JWT
    );

    responder.creado(res, documento, 'Documento subido exitosamente');
  }

  /**
   * GET /api/dt_documento/:id/descargar?inline=true
   *
   * Envía el archivo al cliente mediante ReadStream (sin cargarlo en RAM).
   *
   * Query params:
   *   - inline=true  → el navegador intenta mostrar el archivo (PDF, imágenes)
   *   - inline=false (default) → fuerza descarga con el nombre original
   */
  async descargar(req: Request, res: Response): Promise<void> {
    const id = Number(req.params['id']);
    const inline = req.query['inline'] === 'true';

    const { doc, rutaAbsoluta } = await dtDocumentoService.obtenerParaDescarga(id);

    // Usa el nombre_original para el header — el usuario ve el nombre real, no el hash
    await descargarArchivo(res, rutaAbsoluta, doc.nombre_original, !inline);
  }
}

export default new DtDocumentoController();
