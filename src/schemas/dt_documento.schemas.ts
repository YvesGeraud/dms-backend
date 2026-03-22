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
     * Id de la persona/expediente al que pertenece el documento.
     * Se usa como nombre de subcarpeta en uploads/ (ej: uploads/comun/3/).
     */
    id_ct_rupeet: z.coerce
      .number({ error: 'id_ct_rupeet es requerido' })
      .int()
      .positive('id_ct_rupeet debe ser un número positivo'),

    /**
     * Módulo al que pertenece el documento.
     * Determina la estructura de carpetas donde se guardará el archivo.
     * Ejemplo: 1 = comun, 255 = sistema/Proni
     */
    id_ct_modulo: z.coerce
      .number({ error: 'id_ct_modulo es requerido' })
      .int()
      .positive('id_ct_modulo debe ser un número positivo'),
  }),
});

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type SubirDocumentoDTO = z.infer<typeof subirDocumentoSchema>['body'];
