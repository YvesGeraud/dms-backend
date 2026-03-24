import { z } from 'zod';

// ── Campos ordenables (whitelist) ─────────────────────────────────────────────

/**
 * Exportado para usarlo también en parsearPaginacion() del controller,
 * garantizando que schema y util usen exactamente la misma lista.
 */
export const CAMPOS_ORDENABLES_CT_TIPO_DOCUMENTO = ['id_ct_tipo_documento', 'clave'] as const;

// ── Campos base reutilizables ─────────────────────────────────────────────────

/**
 * Definición única de cada campo. Los schemas de crear/actualizar
 * los comparten para no duplicar reglas de validación.
 */
const campos = {
  clave: z
    .string({ error: 'La clave es requerida' })
    .trim()
    .min(1, 'La clave no puede estar vacía')
    .max(50, 'La clave no puede superar 50 caracteres'),

  descripcion: z
    .string({ error: 'La descripción es requerida' })
    .trim()
    .min(1, 'La descripción no puede estar vacía')
    .max(255, 'La descripción no puede superar 255 caracteres'),

  max_size_bytes: z
    .number({ error: 'El tamaño máximo es requerido' })
    .int('El tamaño máximo debe ser un número entero')
    .positive('El tamaño máximo debe ser mayor a 0'),

  extensiones_permitidas: z
    .string()
    .trim()
    .max(255, 'Las extensiones permitidas no pueden superar 255 caracteres')
    .optional(),

  modulo: z
    .string({ error: 'El módulo es requerido' })
    .trim()
    .min(1, 'El módulo no puede estar vacío')
    .max(100, 'El módulo no puede superar 100 caracteres'),
};

// ── Schemas ───────────────────────────────────────────────────────────────────

export const crearCtTipoDocumentoSchema = z.object({
  body: z.object(campos),
});

export const actualizarCtTipoDocumentoSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('El id debe ser un número positivo'),
  }),
  body: z
    .object({
      clave: campos.clave.optional(),
      descripcion: campos.descripcion.optional(),
      max_size_bytes: campos.max_size_bytes.optional(),
      extensiones_permitidas: campos.extensiones_permitidas.optional(),
      modulo: campos.modulo.optional(),
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

export const filtrosCtTipoDocumentoSchema = z.object({
  query: z.object({
    pagina: z.coerce.number().int().positive().optional(),
    limite: z.coerce.number().int().positive().max(100).optional(),
    busqueda: z.string().trim().optional(),
    estado: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    ordenar_por: z.enum(CAMPOS_ORDENABLES_CT_TIPO_DOCUMENTO).optional(),
    orden: z.enum(['asc', 'desc']).optional(),
  }),
});

/**
 * Batch: array de tipos de documento para crear en un solo request.
 * Mínimo 1, máximo 500 por lote — evita payloads que saturen la BD.
 */
export const crearCtTipoDocumentosLoteSchema = z.object({
  body: z
    .array(z.object(campos))
    .min(1, 'Se requiere al menos un tipo de documento en el lote')
    .max(500, 'El máximo por lote es 500 tipos de documento'),
});

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearCtTipoDocumentoDTO = z.infer<typeof crearCtTipoDocumentoSchema>['body'];
export type ActualizarCtTipoDocumentoDTO = z.infer<typeof actualizarCtTipoDocumentoSchema>['body'];
export type FiltrosCtTipoDocumento = z.infer<typeof filtrosCtTipoDocumentoSchema>['query'];
export type CrearCtTipoDocumentosLoteDTO = z.infer<typeof crearCtTipoDocumentosLoteSchema>['body'];
