//import type { RolUsuario } from '@/generated/prisma/client';
import type { Meta } from '@/utils/respuestas.utils';

// ── Usuario autenticado ───────────────────────────────────────────────────────

/**
 * Datos del usuario disponibles en req.usuario después de validar el JWT.
 * Solo incluye lo mínimo para autenticación y autorización — nunca la contraseña.
 * Para obtener nombre_completo u otros datos, consultar la BD (ej: endpoint /me).
 */
export interface UsuarioAutenticado {
  id_ct_usuario: number;
  usuario: string;
  email: string | null; // nullable según el schema de BD
  //rol: RolUsuario; // enum tipado, no string libre
}

/**
 * Payload firmado dentro del JWT (access y refresh token).
 * Se mantiene mínimo — datos que rara vez cambian y son necesarios en cada request.
 * nombre_completo excluido deliberadamente: demasiado para cargar en cada petición.
 */
export interface PayloadJWT {
  id_ct_usuario: number;
  usuario: string;
  email: string | null;
  //rol: RolUsuario;
}

// ── Respuestas ────────────────────────────────────────────────────────────────

/**
 * Alias de conveniencia para el resultado paginado.
 * Compatible con `responder.paginado(res, datos, meta)`.
 *
 * Uso: const resultado: ResultadoPaginado<Platillo> = await paginar(...)
 */
export type ResultadoPaginado<T> = { datos: T[] } & Meta;

// ── Augmentación de Express ───────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace Express {
    interface Request {
      /**
       * Disponible solo en rutas protegidas, después del middleware de autenticación.
       * Acceder sin verificar si está definido en rutas públicas lanzará un error.
       */
      usuario?: UsuarioAutenticado;
    }
  }
}
