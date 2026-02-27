import { Prisma, ct_tipo_documento } from "@/generated/prisma/client";
import { prisma } from "@/config/database.config";
import {
  ErrorNoEncontrado,
  ErrorNegocio,
  ErrorValidacion,
} from "@/utils/errores.utils";
import { OpcionesPaginacion, ResultadoPaginado } from "@/types";

// ─── DTOs ────────────────────────────────────────────────────────────────────

export type CrearTipoDocumentoDto = {
  clave: string;
  descripcion: string;
  max_size_bytes: number;
  extensiones_permitidas: string[];
  id_ct_usuario_in: number;
};

export type ActualizarTipoDocumentoDto = Partial<
  Omit<CrearTipoDocumentoDto, "id_ct_usuario_in">
> & {
  id_ct_usuario_up: number;
};

// ─── Helpers privados ─────────────────────────────────────────────────────────

/** Normaliza una lista de extensiones: trim + lowercase */
function normalizarExtensiones(extensiones: string[]): string[] {
  return extensiones.map((ext) => ext.trim().toLowerCase());
}

/** Serializa extensiones para persistencia */
function serializarExtensiones(extensiones: string[]): string {
  return JSON.stringify(normalizarExtensiones(extensiones));
}

/** Valida que el tamaño máximo sea positivo */
function validarMaxSize(bytes: number): void {
  if (bytes <= 0) {
    throw new ErrorValidacion("El tamaño máximo debe ser mayor a 0 bytes");
  }
}

/** Valida que haya al menos una extensión */
function validarExtensiones(extensiones: string[]): void {
  if (extensiones.length === 0) {
    throw new ErrorValidacion("Debe indicar al menos una extensión permitida");
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const TipoDocumentoService = {
  async listar(
    opciones: OpcionesPaginacion & { soloActivos?: boolean }
  ): Promise<ResultadoPaginado<ct_tipo_documento>> {
    const {
      pagina = 1,
      limite = 10,
      ordenarPor = "id_ct_tipo_documento",
      orden = "asc",
      soloActivos = true,
    } = opciones;

    const where: Prisma.ct_tipo_documentoWhereInput = soloActivos
      ? { estado: true }
      : {};

    const [datos, total] = await Promise.all([
      prisma.ct_tipo_documento.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { [ordenarPor]: orden },
      }),
      prisma.ct_tipo_documento.count({ where }),
    ]);

    return {
      datos,
      paginaActual: pagina,
      totalPaginas: Math.ceil(total / limite),
      totalRegistros: total,
      registrosPorPagina: limite,
    };
  },

  async obtenerPorId(id: number): Promise<ct_tipo_documento> {
    const tipo = await prisma.ct_tipo_documento.findUnique({
      where: { id_ct_tipo_documento: id },
    });

    if (!tipo) {
      throw new ErrorNoEncontrado(
        `Tipo de documento con id ${id} no encontrado`
      );
    }

    return tipo;
  },

  async obtenerPorClave(clave: string): Promise<ct_tipo_documento> {
    const tipo = await prisma.ct_tipo_documento.findUnique({
      where: { clave },
    });

    if (!tipo) {
      throw new ErrorNoEncontrado(
        `Tipo de documento con clave "${clave}" no encontrado`
      );
    }

    return tipo;
  },

  async crear(dto: CrearTipoDocumentoDto): Promise<ct_tipo_documento> {
    const clave = dto.clave.trim().toUpperCase();

    const existe = await prisma.ct_tipo_documento.findUnique({
      where: { clave },
    });

    if (existe) {
      throw new ErrorNegocio(
        `Ya existe un tipo de documento con la clave "${clave}"`
      );
    }

    validarMaxSize(dto.max_size_bytes);
    validarExtensiones(dto.extensiones_permitidas);

    return prisma.ct_tipo_documento.create({
      data: {
        clave,
        descripcion: dto.descripcion.trim(),
        max_size_bytes: dto.max_size_bytes,
        extensiones_permitidas: serializarExtensiones(
          dto.extensiones_permitidas
        ),
        id_ct_usuario_in: dto.id_ct_usuario_in,
      },
    });
  },

  async actualizar(
    id: number,
    dto: ActualizarTipoDocumentoDto
  ): Promise<ct_tipo_documento> {
    await TipoDocumentoService.obtenerPorId(id);

    const data: Prisma.ct_tipo_documentoUpdateInput = {
      fecha_up: new Date(),
      id_ct_usuario_up: dto.id_ct_usuario_up,
    };

    if (dto.clave !== undefined) {
      const clave = dto.clave.trim().toUpperCase();
      const duplicado = await prisma.ct_tipo_documento.findFirst({
        where: { clave, NOT: { id_ct_tipo_documento: id } },
      });
      if (duplicado) {
        throw new ErrorNegocio(
          `Ya existe otro tipo de documento con la clave "${clave}"`
        );
      }
      data.clave = clave;
    }

    if (dto.descripcion !== undefined) {
      data.descripcion = dto.descripcion.trim();
    }

    if (dto.max_size_bytes !== undefined) {
      validarMaxSize(dto.max_size_bytes);
      data.max_size_bytes = dto.max_size_bytes;
    }

    if (dto.extensiones_permitidas !== undefined) {
      validarExtensiones(dto.extensiones_permitidas);
      data.extensiones_permitidas = serializarExtensiones(
        dto.extensiones_permitidas
      );
    }

    return prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data,
    });
  },

  async desactivar(id: number, idUsuario: number): Promise<ct_tipo_documento> {
    const tipo = await TipoDocumentoService.obtenerPorId(id);

    if (!tipo.estado) {
      throw new ErrorNegocio("El tipo de documento ya está desactivado");
    }

    return prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data: { estado: false, fecha_up: new Date(), id_ct_usuario_up: idUsuario },
    });
  },

  async activar(id: number, idUsuario: number): Promise<ct_tipo_documento> {
    const tipo = await TipoDocumentoService.obtenerPorId(id);

    if (tipo.estado) {
      throw new ErrorNegocio("El tipo de documento ya está activo");
    }

    return prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data: { estado: true, fecha_up: new Date(), id_ct_usuario_up: idUsuario },
    });
  },
};
