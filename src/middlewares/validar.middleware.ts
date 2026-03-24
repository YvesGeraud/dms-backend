import type { Request, Response, NextFunction } from 'express';
import { type ZodType } from 'zod'; // ZodSchema fue reemplazado por ZodType en Zod v4

/**
 * Middleware de validación genérico basado en Zod.
 * Valida body, query y params en una sola pasada.
 * Si falla, pasa el ZodError al error middleware (que lo convierte en 400).
 * Si pasa, reemplaza los valores con los ya parseados y tipados por Zod.
 *
 * Uso en rutas:
 *   router.post('/', validar(CrearPlatilloSchema), controlador);
 *
 * El schema debe tener la forma:
 *   z.object({ body: z.object({...}), query: z.object({...}), params: z.object({...}) })
 */
export const validar = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resultado = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!resultado.success) {
      next(resultado.error); // ZodError → error middleware → 400 con detalles por campo
      return;
    }

    // Escribe los valores ya parseados por Zod (coerción de tipos incluida).
    // Express 5: req.query es un getter de solo lectura — no se puede reasignar con =,
    // pero sí se puede mutar el objeto con Object.assign.
    // req.body y req.params sí son propiedades escribibles normales.
    const datos = resultado.data as {
      body?: unknown;
      query?: Record<string, unknown>;
      params?: unknown;
    };
    if (datos.body !== undefined) req.body = datos.body;
    if (datos.query !== undefined) Object.assign(req.query, datos.query);
    if (datos.params !== undefined) req.params = datos.params as typeof req.params;

    next();
  };
};
