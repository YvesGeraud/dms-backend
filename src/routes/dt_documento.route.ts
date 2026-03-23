import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import dtDocumentoController from '@/controllers/dt_documento.controller';
import { validar } from '@/middlewares/validar.middleware';
import { subirDocumentoSchema } from '@/schemas/dt_documento.schemas';

const router = express.Router();

// memoryStorage: el archivo queda en req.file.buffer mientras se procesa.
// El servicio valida contra BD y luego escribe a disco con el path correcto.
const memoriaUpload = multer({ storage: multer.memoryStorage() });

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
 *   - id_ct_rupeet         : number
 *   - id_ct_modulo         : number
 */
router.post(
  '/subir',
  memoriaUpload.single('archivo'), // 1° multer pone el buffer en req.file
  validar(subirDocumentoSchema), // 2° Zod valida los 3 IDs del body
  dtDocumentoController.subir, // 3° controlador llama al servicio
);

/**
 * GET /api/dt_documento/:hash/descargar?inline=true
 *
 * Descarga un documento mediante ReadStream (sin cargarlo en RAM).
 *   - inline=true  → el navegador muestra el archivo (PDF, imágenes)
 *   - inline=false → fuerza descarga con el nombre original del archivo
 */
router.get('/:hash/descargar', validar(hashParamSchema), dtDocumentoController.descargar);

export default router;
