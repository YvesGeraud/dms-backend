import { z } from 'zod';

// ── Schema de subida ─────────────────────────────────────────────────────────
//
// Los campos llegan como strings en multipart/form-data → z.coerce.number()
// los convierte automáticamente antes de validar.

export const subirDocumentoSchema = z.object({
  body: z.object({
    /**
     * Tipo de documento a subir (FK → ct_tipo_documento).
     * Determina extensiones y tamaño máximo permitido.
     */
    id_ct_tipo_documento: z.coerce
      .number({ error: 'id_ct_tipo_documento es requerido' })
      .int()
      .positive('id_ct_tipo_documento debe ser un número positivo'),

    /**
     * Id del usuario al que pertenece el documento.
     * Se usa como nombre de subcarpeta en uploads/ (ej: uploads/comun/3/).
     */
    id_ct_usuario: z.coerce
      .number({ error: 'id_ct_usuario es requerido' })
      .int()
      .positive('id_ct_usuario debe ser un número positivo'),

  }),
});

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type SubirDocumentoDTO = z.infer<typeof subirDocumentoSchema>['body'];
