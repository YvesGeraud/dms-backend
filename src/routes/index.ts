import express from 'express';
import ctTipoDocumentoRoute from './ct_tipo_documentos.route';
import dtDocumentoRoute from './dt_documento.route';

export const router = express.Router();

import { config } from '@/config/servidor.config';
router.get('/debug-env', (req, res) => {
  res.json({
    config: {
      dbConfig: config.db,
      enviroment: config.nodeEnv,
      isProd: config.esProduccion
    },
    processEnv: {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

router.use('/ct_tipo_documento', ctTipoDocumentoRoute);
router.use('/dt_documento', dtDocumentoRoute);
