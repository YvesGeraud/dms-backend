import { ct_tipo_documento } from "@/generated/prisma/client";
import { prisma } from "@/config/database.config";
import {
  ErrorNoEncontrado,
  ErrorNegocio,
  ErrorValidacion,
} from "@/utils/errores.utils";
import { OpcionesPaginacion, ResultadoPaginado } from "@/types";

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

export const TipoDocumentoService = {
  async listar(
    opciones: OpcionesPaginacion & { soloActivos?: boolean }
  ): Promise<ResultadoPaginado<ct_tipo_documento>> {
    const { pagina = 1, limite = 10, ordenarPor = "id_ct_tipo_documento", orden = "asc", soloActivos = true } = opciones;
    const saltar = (pagina - 1) * limite;

    const where = soloActivos ? { estado: true } : {};

    const [datos, total] = await Promise.all([
      prisma.ct_tipo_documento.findMany({
        where,
        skip: saltar,
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
      throw new ErrorNoEncontrado(`Tipo de documento con id ${id} no encontrado`);
    }

    return tipo;
  },

  async obtenerPorClave(clave: string): Promise<ct_tipo_documento> {
    const tipo = await prisma.ct_tipo_documento.findUnique({
      where: { clave },
    });

    if (!tipo) {
      throw new ErrorNoEncontrado(`Tipo de documento con clave "${clave}" no encontrado`);
    }

    return tipo;
  },

  async crear(dto: CrearTipoDocumentoDto): Promise<ct_tipo_documento> {
    const claveNormalizada = dto.clave.trim().toUpperCase();

    const existe = await prisma.ct_tipo_documento.findUnique({
      where: { clave: claveNormalizada },
    });

    if (existe) {
      throw new ErrorNegocio(`Ya existe un tipo de documento con la clave "${claveNormalizada}"`);
    }

    if (dto.max_size_bytes <= 0) {
      throw new ErrorValidacion("El tamaño máximo debe ser mayor a 0 bytes");
    }

    if (!dto.extensiones_permitidas.length) {
      throw new ErrorValidacion("Debe indicar al menos una extensión permitida");
    }

    return prisma.ct_tipo_documento.create({
      data: {
        clave: claveNormalizada,
        descripcion: dto.descripcion.trim(),
        max_size_bytes: dto.max_size_bytes,
        extensiones_permitidas: JSON.stringify(dto.extensiones_permitidas),
        id_ct_usuario_in: dto.id_ct_usuario_in,
      },
    });
  },

  async actualizar(
    id: number,
    dto: ActualizarTipoDocumentoDto
  ): Promise<ct_tipo_documento> {
    await TipoDocumentoService.obtenerPorId(id);

    const datos: Record<string, any> = {
      fecha_up: new Date(),
      id_ct_usuario_up: dto.id_ct_usuario_up,
    };

    if (dto.clave !== undefined) {
      const claveNormalizada = dto.clave.trim().toUpperCase();
      const duplicado = await prisma.ct_tipo_documento.findFirst({
        where: { clave: claveNormalizada, NOT: { id_ct_tipo_documento: id } },
      });
      if (duplicado) {
        throw new ErrorNegocio(`Ya existe otro tipo de documento con la clave "${claveNormalizada}"`);
      }
      datos.clave = claveNormalizada;
    }

    if (dto.descripcion !== undefined) datos.descripcion = dto.descripcion.trim();
    if (dto.max_size_bytes !== undefined) {
      if (dto.max_size_bytes <= 0) throw new ErrorValidacion("El tamaño máximo debe ser mayor a 0 bytes");
      datos.max_size_bytes = dto.max_size_bytes;
    }
    if (dto.extensiones_permitidas !== undefined) {
      if (!dto.extensiones_permitidas.length) throw new ErrorValidacion("Debe indicar al menos una extensión permitida");
      datos.extensiones_permitidas = JSON.stringify(dto.extensiones_permitidas);
    }

    return prisma.ct_tipo_documento.update({
      where: { id_ct_tipo_documento: id },
      data: datos,
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
