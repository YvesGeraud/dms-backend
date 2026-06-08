import type { Request, Response } from 'express';
import dtDocumentoService from '@/services/dt_documento.service';
import { responder } from '@/utils/respuestas.utils';
import { ErrorNegocio } from '@/utils/errores.utils';
import { descargarArchivo, comprimirArchivos } from '@/utils/archivo.utils';
import type { SubirDocumentoDTO } from '@/schemas/dt_documento.schemas';

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
   *   - id_ct_usuario        : number  (a qué usuario pertenece)
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
   * POST /api/dt_documento/subir-batch
   *
   * Toma un arreglo de archivos (req.files) y un conjunto de metadatos (req.body)
   * y llama al servicio para procesarlos en lote.
   */
  async subirBatch(req: Request, res: Response): Promise<void> {
    const archivos = req.files as Express.Multer.File[];

    if (!archivos || archivos.length === 0) {
      throw new ErrorNegocio(
        'No se recibió ningún archivo. Envía al menos un archivo en el campo "archivos".',
      );
    }

    const documentos = await dtDocumentoService.subirDocumentosBatch(
      req.body as SubirDocumentoDTO,
      archivos,
      1, // TODO: reemplazar con req.user.id cuando se integre JWT
    );

    responder.creado(res, documentos, `${documentos.length} documento(s) subido(s) exitosamente`);
  }

  /**
   * GET /api/dt_documento/:hash/descargar?inline=true
   *
   * Envía el archivo al cliente mediante ReadStream (sin cargarlo en RAM).
   *
   * Query params:
   *   - inline=true  → el navegador intenta mostrar el archivo (PDF, imágenes)
   *   - inline=false (default) → fuerza descarga con el nombre original
   */
  async descargar(req: Request, res: Response): Promise<void> {
    const hash = req.params['hash'] as string;
    const inline = req.query['inline'] === 'true';

    const { doc, rutaAbsoluta } = await dtDocumentoService.obtenerParaDescarga(hash);

    if (doc.storage_provider === 's3') {
      const { obtenerPreSignedUrl } = await import('@/utils/s3.utils');
      const url = await obtenerPreSignedUrl(rutaAbsoluta, doc.nombre_original, inline);
      res.redirect(302, url);
      return;
    }

    // Usa el nombre_original para el header — el usuario ve el nombre real, no el hash
    await descargarArchivo(res, rutaAbsoluta, doc.nombre_original, !inline);
  }

  /**
   * GET /api/dt_documento/tipo/:id/descargar?estado=1
   *
   * Descarga todos los documentos de un tipo en un solo ZIP.
   */
  async descargarPorTipo(req: Request, res: Response): Promise<void> {
    const idsQuery = req.query['ids'] as string;
    const idParam = req.params['id'];
    const estado = req.query['estado'] !== '0';
    const conCarpetas = req.query['carpetas'] === 'true';

    let ids: number[] = [];

    if (idsQuery) {
      // Maneja ?ids=1,2,3
      ids = idsQuery
        .split(',')
        .map(Number)
        .filter((id) => !isNaN(id));
    } else if (idParam) {
      // Maneja /tipo/:id/descargar
      const id = Number(idParam);
      if (!isNaN(id)) ids = [id];
    }

    if (ids.length === 0) {
      throw new ErrorNegocio('Se requiere al menos un ID de tipo de documento válido.');
    }

    const documentos = await dtDocumentoService.obtenerPorTipoYEstado(ids, estado);

    if (documentos.length === 0) {
      throw new ErrorNegocio('No se encontraron documentos para los tipos y estado solicitados.');
    }

    const archivos = documentos.map((doc) => {
      let nombreDeseado = doc.nombre_original;

      if (conCarpetas) {
        // Estructura: modulo/id_usuario/archivo.ext
        const modulo = doc.ct_tipo_documento.modulo.replace(/\s+/g, '_').toLowerCase();
        nombreDeseado = `${modulo}/${doc.id_ct_usuario}/${doc.nombre_original}`;
      }

      return {
        rutaAbsoluta: doc.rutaAbsoluta,
        nombreDeseado,
        isS3: doc.isS3,
        s3Key: doc.s3Key,
      };
    });

    // El nombre del ZIP será descriptivo
    let nombreZip = 'documentos';
    if (ids.length === 1 && documentos[0]?.ct_tipo_documento?.descripcion) {
      const desc = documentos[0].ct_tipo_documento.descripcion;
      nombreZip = `${desc.replace(/\s+/g, '_')}_${ids[0]}`;
    } else {
      nombreZip = `lote_documentos_${ids.join('_')}`;
    }

    await comprimirArchivos(res, archivos, nombreZip);
  }

  /**
   * POST /api/dt_documento/descargar-batch
   *
   * Descarga múltiples documentos en un solo ZIP dado un arreglo de hashes.
   * Diseñado para lotes masivos (1700+ archivos).
   *
   * Body JSON:
   *   - hashes   : string[]  (obligatorio, máximo 2000)
   *   - carpetas : boolean   (opcional, organiza por modulo/usuario)
   *
   * El ZIP se envía con streaming — no se almacena en disco ni en RAM.
   * Si algún hash no se encuentra, se incluye un _manifiesto.txt en el ZIP.
   */
  async descargarBatch(req: Request, res: Response): Promise<void> {
    const { hashes, carpetas = false } = req.body as {
      hashes: string[];
      carpetas?: boolean;
    };

    if (!Array.isArray(hashes) || hashes.length === 0) {
      throw new ErrorNegocio('Se requiere un arreglo "hashes" con al menos un elemento.');
    }

    if (hashes.length > 2000) {
      throw new ErrorNegocio('El máximo de hashes por petición es 2000.');
    }

    // Deduplicar hashes en la petición (el cliente podría enviar repetidos)
    const hashesUnicos = [...new Set(hashes)];

    const { documentos, hashesNoEncontrados } =
      await dtDocumentoService.obtenerPorHashes(hashesUnicos);

    if (documentos.length === 0) {
      throw new ErrorNegocio('No se encontró ningún documento para los hashes proporcionados.');
    }

    // Construir lista de archivos para el ZIP
    const archivos = documentos.map((doc) => {
      let nombreDeseado = doc.nombre_original;

      if (carpetas) {
        const modulo = doc.ct_tipo_documento.modulo.replace(/\s+/g, '_').toLowerCase();
        nombreDeseado = `${modulo}/${doc.id_ct_usuario}/${doc.nombre_original}`;
      }

      return {
        rutaAbsoluta: doc.rutaAbsoluta,
        nombreDeseado,
        isS3: doc.isS3,
        s3Key: doc.s3Key,
      };
    });

    // Nombre descriptivo para el ZIP
    const nombreZip = `batch_${documentos.length}_documentos`;

    // Usar comprimirArchivos con manifiesto de errores
    await comprimirArchivos(res, archivos, nombreZip, hashesNoEncontrados);
  }

  /**
   * DELETE /api/dt_documento/:hash
   *
   * Realiza un borrado lógico del documento.
   */
  async eliminar(req: Request, res: Response): Promise<void> {
    const hash = req.params['hash'] as string;

    await dtDocumentoService.desactivarPorHash(hash);

    responder.ok(res, null, 'Documento eliminado exitosamente');
  }
}

export default new DtDocumentoController();
