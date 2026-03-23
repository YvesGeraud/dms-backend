import express from 'express';
import ctTipoDocumentoRoute from './ct_tipo_documentos.route';
import dtDocumentoRoute from './dt_documento.route';

export const router = express.Router();

router.use('/ct_tipo_documento', ctTipoDocumentoRoute);
router.use('/dt_documento', dtDocumentoRoute);
