import express from 'express';
import ctTipoDocumentoRoute from './ct_tipo_documentos.route';
import dtDocumentoRoute from './dt_documento.route';

export const router = express.Router();

import mariadb from 'mariadb';
import { config } from '@/config/servidor.config';

router.get('/debug-db', async (req, res) => {
  const dbInfo = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.usuario,
    database: config.db.nombre,
    constructedUrl: config.db.url,
    rawEnv: {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DBNAMES: process.env.DBNAMES,
      DATABASE_URL: process.env.DATABASE_URL,
    }
  };

  try {
    const conn = await mariadb.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.usuario,
      password: config.db.password,
      database: config.db.nombre,
      connectTimeout: 5000,
    });
    await conn.query('SELECT 1');
    await conn.end();
    res.json({ ...dbInfo, conexion: 'EXITOSA' });
  } catch (err: any) {
    res.status(500).json({ ...dbInfo, conexion: 'FALLIDA', error: err.message, code: err.code });
  }
});

router.use('/ct_tipo_documento', ctTipoDocumentoRoute);
router.use('/dt_documento', dtDocumentoRoute);
