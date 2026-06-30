import express from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import dtDocumentoController from '@/controllers/dt_documento.controller';
import { validar } from '@/middlewares/validar.middleware';
import { subirDocumentoSchema } from '@/schemas/dt_documento.schemas';

const router = express.Router();

// memoryStorage: el archivo queda en req.file.buffer mientras se procesa.
// El servicio valida contra BD y luego escribe a disco con el path correcto.
// Límite de 50 MB absoluto para evitar que archivos enormes saturen la RAM antes de validar.
const memoriaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Rate limiter específico para endpoints de descarga ZIP.
// Más estricto que el global (500/15 min): máximo 5 ZIPs por IP por minuto.
const limitarDescargaZip = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    exito: false,
    mensaje: 'Demasiadas solicitudes de descarga desde tu IP. Espera un minuto.',
    codigo: 'TOO_MANY_REQUESTS',
  },
});

// Schema reutilizable para validar :hash en params
const hashParamSchema = z.object({
  params: z.object({
    hash: z.string().min(1, 'El hash es requerido'),
  }),
});

/**
 * POST /api/dt_documento/subir
 *
 * Sube un archivo y lo registra en dt_documento.
 * Body (multipart/form-data):
 *   - archivo              : File
 *   - id_ct_tipo_documento : number
 *   - id_ct_usuario        : number
 */
router.post(
  '/subir',
  memoriaUpload.single('archivo'), // 1° multer pone el buffer en req.file
  validar(subirDocumentoSchema), // 2° Zod valida los IDs del body
  dtDocumentoController.subir, // 3° controlador llama al servicio
);

/**
 * POST /api/dt_documento/subir-batch
 *
 * Sube múltiples archivos y los registra en dt_documento.
 * Body (multipart/form-data):
 *   - archivos             : File[] (hasta 10 archivos)
 *   - id_ct_tipo_documento : number
 *   - id_ct_usuario        : number
 */
router.post(
  '/subir-batch',
  memoriaUpload.array('archivos', 10), // multer deja un array de buffers en req.files
  validar(subirDocumentoSchema), // usa la misma validación de metadata
  dtDocumentoController.subirBatch,
);

/**
 * POST /api/dt_documento/descargar-batch
 *
 * Descarga múltiples documentos en un ZIP dado un arreglo de hashes.
 * Soporta lotes masivos (5000+ archivos) con streaming.
 *
 * Body JSON:
 *   - hashes   : string[]  (obligatorio, máximo 5000)
 *   - carpetas : boolean   (opcional, organiza en subcarpetas)
 *
 * Se usa POST en vez de GET porque miles de hashes SHA-256 superan el límite de URL.
 * El límite de body se sube a 500kb en setup.ts (suficiente para ~5000 hashes de 64 chars).
 */
router.post('/descargar-batch', limitarDescargaZip, dtDocumentoController.descargarBatch);

/**
 * GET /api/dt_documento/lote/descargar?ids=1,2,3&estado=1&carpetas=true
 *
 * Descarga documentos de múltiples tipos en un solo ZIP.
 */
router.get('/lote/descargar', limitarDescargaZip, dtDocumentoController.descargarPorTipo);

/**
 * GET /api/dt_documento/tipo/:id/descargar
 *
 * Descarga todos los documentos de un tipo dado en un solo ZIP.
 * Query params opcionales:
 *   - estado=1 (default) | estado=0 para descargar los inactivos
 */
router.get('/tipo/:id/descargar', limitarDescargaZip, dtDocumentoController.descargarPorTipo);

/**
 * GET /api/dt_documento/:hash/descargar?inline=true
 *
 * Descarga un documento mediante ReadStream (sin cargarlo en RAM).
 *   - inline=true  → el navegador muestra el archivo (PDF, imágenes)
 *   - inline=false → fuerza descarga con el nombre original del archivo
 */
router.get('/:hash/descargar', validar(hashParamSchema), dtDocumentoController.descargar);

/**
 * DELETE /api/dt_documento/:hash
 *
 * Realiza un borrado lógico del documento.
 */
router.delete('/:hash', validar(hashParamSchema), dtDocumentoController.eliminar);

export default router;
