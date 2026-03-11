import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorAutenticacion } from "../utils/errores.utils";
import configuracionServidor from "../config/servidor.config";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PayloadJwt {
  id: number;
  correo: string;
  rol?: string;
}

// Extender la interfaz de Express para que req.usuario esté disponible
declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadJwt;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Middleware que verifica el JWT en el header Authorization.
 * Si el token es válido, inyecta el payload decodificado en req.usuario.
 *
 * Uso: app.use(verificarJwt) o por ruta: router.get("/ruta", verificarJwt, handler)
 *
 * Header esperado: Authorization: Bearer <token>
 */
export const verificarJwt = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return next(new ErrorAutenticacion("Se requiere el header Authorization"));
  }

  const partes = authHeader.split(" ");

  if (partes.length !== 2 || partes[0]?.toLowerCase() !== "bearer") {
    return next(
      new ErrorAutenticacion("Formato de token inválido. Use: Bearer <token>")
    );
  }

  const token = partes[1];

  if (!token) {
    return next(new ErrorAutenticacion("Token no proporcionado"));
  }

  try {
    const payload = jwt.verify(
      token,
      configuracionServidor.jwt.secreto
    ) as PayloadJwt;

    req.usuario = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ErrorAutenticacion("El token ha expirado"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ErrorAutenticacion("Token inválido o mal formado"));
    }
    next(error);
  }
};
