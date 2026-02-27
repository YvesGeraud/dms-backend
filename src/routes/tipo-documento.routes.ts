import { Router } from "express";
import {
  listarTiposDocumento,
  obtenerTipoDocumento,
  crearTipoDocumento,
  actualizarTipoDocumento,
  desactivarTipoDocumento,
  activarTipoDocumento,
} from "@/controllers/tipo-documento.controller";
import { verificarJwt } from "@/middleware/auth.middleware";

const router = Router();

// Todas las rutas de tipos de documento requieren JWT
router.use(verificarJwt);

/**
 * GET    /api/tipos-documento          — Listar (paginado, ?soloActivos=true|false)
 * GET    /api/tipos-documento/:id      — Obtener por id
 * POST   /api/tipos-documento          — Crear
 * PUT    /api/tipos-documento/:id      — Actualizar
 * DELETE /api/tipos-documento/:id      — Desactivar (soft delete)
 * PATCH  /api/tipos-documento/:id/activar — Reactivar
 */
router.get("/", listarTiposDocumento);
router.get("/:id", obtenerTipoDocumento);
router.post("/", crearTipoDocumento);
router.put("/:id", actualizarTipoDocumento);
router.delete("/:id", desactivarTipoDocumento);
router.patch("/:id/activar", activarTipoDocumento);

export default router;
