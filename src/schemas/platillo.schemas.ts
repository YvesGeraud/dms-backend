import { z } from 'zod';

// ── Campos ordenables (whitelist) ─────────────────────────────────────────────

/**
 * Exportado para usarlo también en parsearPaginacion() del controller,
 * garantizando que schema y util usen exactamente la misma lista.
 */
export const CAMPOS_ORDENABLES_PLATILLO = [
  'nombre',
  'precio',
  'fecha_registro',
  'id_ct_categoria',
] as const;

// ── Campos base reutilizables ─────────────────────────────────────────────────

/**
 * Definición única de cada campo. Los schemas de crear/actualizar
 * los comparten para no duplicar reglas de validación.
 */
const campos = {
  id_ct_categoria: z
    .number({ error: 'La categoría es requerida' })
    .int()
    .positive('El id de categoría debe ser un número positivo'),

  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre no puede superar 200 caracteres'),

  descripcion: z
    .string()
    .trim()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .optional(),

  precio: z.number({ error: 'El precio es requerido' }).positive('El precio debe ser mayor a 0'),

  imagen_url: z.string().url('La URL de la imagen no es válida').optional(),
};

// ── Schemas ───────────────────────────────────────────────────────────────────

export const crearPlatilloSchema = z.object({
  body: z.object(campos),
});

export const actualizarPlatilloSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('El id debe ser un número positivo'),
  }),
  body: z
    .object({
      id_ct_categoria: campos.id_ct_categoria.optional(),
      nombre: campos.nombre.optional(),
      descripcion: campos.descripcion,
      precio: campos.precio.optional(),
      // null = eliminar imagen explícitamente | undefined = no tocar el campo
      imagen_url: campos.imagen_url.or(z.null()).optional(),
      estado: z.boolean().optional(),
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: 'Debes enviar al menos un campo para actualizar',
    }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('El id debe ser un número positivo'),
  }),
});

export const filtrosPlatillosSchema = z.object({
  query: z.object({
    pagina: z.coerce.number().int().positive().optional(),
    limite: z.coerce.number().int().positive().max(100).optional(),
    busqueda: z.string().trim().optional(),
    id_ct_categoria: z.coerce.number().int().positive().optional(),
    estado: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    // Whitelist explícita — evita que el cliente ordene por columnas internas
    ordenar_por: z.enum(CAMPOS_ORDENABLES_PLATILLO).optional(),
    orden: z.enum(['asc', 'desc']).optional(),
  }),
});

/**
 * Batch: array de platillos para crear en un solo request.
 * Mínimo 1, máximo 500 por lote — evita payloads que saturen la BD.
 */
export const crearPlatillosLoteSchema = z.object({
  body: z
    .array(z.object(campos))
    .min(1, 'Se requiere al menos un platillo en el lote')
    .max(500, 'El máximo por lote es 500 platillos'),
});

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearPlatilloDTO = z.infer<typeof crearPlatilloSchema>['body'];
export type ActualizarPlatilloDTO = z.infer<typeof actualizarPlatilloSchema>['body'];
export type FiltrosPlatillos = z.infer<typeof filtrosPlatillosSchema>['query'];
export type CrearPlatillosLoteDTO = z.infer<typeof crearPlatillosLoteSchema>['body'];
