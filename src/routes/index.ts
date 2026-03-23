import { Router } from 'express';

//
import ctTipoDocumentosRoute from '@/routes/ct_tipo_documentos.route.js';
import dtDocumentoRoute from '@/routes/dt_documento.route.js';

export const router = Router();

router.use('/ct_tipo_documento', ctTipoDocumentosRoute);
router.use('/dt_documento', dtDocumentoRoute);
