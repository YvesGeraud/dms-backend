import { Router } from "express";
import {
  subirDocumento,
  subirDocumentos,
  verDocumento,
  descargarDocumento,
} from "@/controllers/documento.controller";
import { subirUno, subirVarios } from "@/config/multer.config";
import { verificarJwt } from "@/middleware/auth.middleware";

const router = Router();

// Todas las rutas de documentos requieren JWT
router.use(verificarJwt);

/**
 * POST /api/documentos/subir          — Sube un archivo ("archivo")
 * POST /api/documentos/subir-varios   — Sube N archivos ("archivos")
 * GET  /api/documentos/:id/ver        — Muestra el archivo inline (stream)
 * GET  /api/documentos/:id/descargar  — Descarga el archivo (attachment)
 */
router.post("/subir", subirUno, subirDocumento);
router.post("/subir-varios", subirVarios, subirDocumentos);
router.get("/:id/ver", verDocumento);
router.get("/:id/descargar", descargarDocumento);

export default router;

