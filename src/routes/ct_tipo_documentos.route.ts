import express from 'express';
import ctTipoDocumentoController from '@/controllers/ct_tipo_documento.controller';
import { validar } from '@/middlewares/validar.middleware';
import {
  crearCtTipoDocumentoSchema,
  actualizarCtTipoDocumentoSchema,
  filtrosCtTipoDocumentoSchema,
  crearCtTipoDocumentosLoteSchema,
} from '@/schemas/ct_tipo_documento.schemas';

const router = express.Router();

router.get('/', validar(filtrosCtTipoDocumentoSchema), ctTipoDocumentoController.listar);
router.get('/:id', ctTipoDocumentoController.obtenerPorId);
router.post('/', validar(crearCtTipoDocumentoSchema), ctTipoDocumentoController.crear);
router.put('/:id', validar(actualizarCtTipoDocumentoSchema), ctTipoDocumentoController.actualizar);
router.delete('/:id', ctTipoDocumentoController.eliminar);
router.post('/lote', validar(crearCtTipoDocumentosLoteSchema), ctTipoDocumentoController.crearLote);

export default router;
