import { Prisma } from '@/generated/prisma/client.js';
import { prisma } from '@/config/database.config.js';
import { buscarOError, verificarNoExiste } from '@/utils/prisma.utils.js';
import { paginar } from '@/utils/paginacion.utils.js';
import { insertarEnLotes } from '@/utils/batch.utils.js';
import type { OpcionesPaginacion } from '@/utils/paginacion.utils.js';
import type {
  CrearCtTipoDocumentoDTO,
  ActualizarCtTipoDocumentoDTO,
  FiltrosCtTipoDocumento,
} from '@/schemas/ct_tipo_documento.schemas.js';
import { CAMPOS_ORDENABLES_CT_TIPO_DOCUMENTO } from '@/schemas/ct_tipo_documento.schemas.js';

// ── Servicio ──────────────────────────────────────────────────────────────────

class CtTipoDocumentoService {
  async obtenerTodos(filtros: FiltrosCtTipoDocumento) {
    const opciones: OpcionesPaginacion = {
      pagina: filtros.pagina ?? 1,
      limite: filtros.limite ?? 10,
      ordenarPor: filtros.ordenar_por ?? CAMPOS_ORDENABLES_CT_TIPO_DOCUMENTO[0],
      orden: filtros.orden ?? 'asc',
    };

    // Prisma.ct_tipo_documentoWhereInput da type-safety en el where (detecta typos en nombres de campo)
    const where: Prisma.ct_tipo_documentoWhereInput = {};

    if (filtros.busqueda) {
      where.OR = [
        { clave: { contains: filtros.busqueda } },
        { descripcion: { contains: filtros.busqueda } },
      ];
    }

    if (filtros.estado !== undefined) {
      where.estado = filtros.estado;
    }

    return paginar(prisma.ct_tipo_documento, where, opciones);
  }

  async obtenerPorId(id: number) {
    return buscarOError(
      prisma.ct_tipo_documento.findUnique({
        where: { id_ct_tipo_documento: id },
      }),
      'ct_tipo_documento',
    );
  }

  async crear(datos: CrearCtTipoDocumentoDTO, id_ct_usuario_in: number) {
    await verificarNoExiste(
      prisma.ct_tipo_documento.findFirst({
        where: { clave: datos.clave, estado: true },
      }),
      'Ya existe un tipo de documento con la misma clave',
    );
    return prisma.ct_tipo_documento.create({
      data: {
        clave: datos.clave,
        descripcion: datos.descripcion,
        max_size_bytes: datos.max_size_bytes,
        extensiones_permitidas: datos.extensiones_permitidas,
        id_ct_usuario_in,
      },
    });
  }

  async actualizar(id: number, datos: ActualizarCtTipoDocumentoDTO, id_ct_usuario_up: number) {
    await buscarOError(
      prisma.ct_tipo_documento.findUnique({
        where: { id_ct_tipo_documento: id },
      }),
      'ct_tipo_documento',
    );

    return prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data: datos,
    });
  }

  async eliminar(id: number) {
    await buscarOError(
      prisma.ct_tipo_documento.findUnique({
        where: { id_ct_tipo_documento: id },
      }),
      'ct_tipo_documento',
    );

    // Soft delete — preserva historial en ct_tipo_documento
    await prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data: { estado: false },
    });
  }

  /**
   * Crea múltiples tipos de documento en lotes.
   * Usa insertarEnLotes para no saturar la BD con un INSERT masivo de golpe.
   * skipDuplicates evita que un nombre repetido aborte todo el lote.
   *
   * Nota: createMany no devuelve los registros creados (limitación de Prisma/MariaDB),
   * solo el conteo. Si necesitas los registros, usa procesarEnLotes con create individual.
   *
   * @example
   * const resultado = await crearCtTipoDocumentosLote(lote, idUsuario);
   * console.log(`Registros creados: ${resultado.creados.length}`);
   * console.log(`Errores:`, resultado.errores);
   */
  async crearMuchos(datos: CrearCtTipoDocumentoDTO[], id_ct_usuario_in: number) {
    return insertarEnLotes(
      prisma.ct_tipo_documento,
      datos.map((d) => ({
        clave: d.clave,
        descripcion: d.descripcion,
        max_size_bytes: d.max_size_bytes,
        extensiones_permitidas: d.extensiones_permitidas,
        id_ct_usuario_in,
      })),
      { tamanioLote: 50 },
    );
  }
}
export default new CtTipoDocumentoService();
