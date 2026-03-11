import fs from "fs";
import path from "path";
import { dt_documento } from "../generated/prisma/client";
import { prisma } from "../config/database.config";
import {
  ErrorNoEncontrado,
  ErrorNegocio,
  ErrorValidacion,
} from "../utils/errores.utils";
import {
  generarHash,
  generarNombreSistema,
  obtenerExtension,
} from "../utils/archivo.utils";

// ─── DTOs ────────────────────────────────────────────────────────────────────

export type SubirDocumentoDto = {
  file: Express.Multer.File;
  id_ct_tipo_documento: number;
  modulo: string;
  referencia_id: number;
  id_ct_usuario_in: number;
};

export type ResultadoSubida =
  | { exito: true; documento: dt_documento }
  | { exito: false; nombre: string; error: string };

export type StreamDescarga = {
  stream: fs.ReadStream;
  mimeType: string;
  nombreOriginal: string;
  tamanioBytes: number;
};

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Parsea el campo extensiones_permitidas del tipo de documento.
 * La columna se almacena como JSON string: '["pdf","jpg","png"]'
 */
function parsearExtensiones(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((e: string) => e.trim().toLowerCase())
      : [];
  } catch {
    return [];
  }
}

/**
 * Escribe el buffer a disco y devuelve la ruta relativa.
 * Crea el directorio si no existe.
 */
function escribirArchivo(
  buffer: Buffer,
  modulo: string,
  nombreSistema: string
): string {
  const dirRelativo = path.join("uploads", modulo);
  const dirAbsoluto = path.resolve(dirRelativo);

  if (!fs.existsSync(dirAbsoluto)) {
    fs.mkdirSync(dirAbsoluto, { recursive: true });
  }

  const rutaAbsoluta = path.join(dirAbsoluto, nombreSistema);
  fs.writeFileSync(rutaAbsoluta, buffer);

  // Guardamos ruta relativa normalizada (separadores /)
  return path.join(dirRelativo, nombreSistema).replace(/\\/g, "/");
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const DocumentoService = {
  /**
   * Obtiene el registro de un documento por ID.
   * La ruta física nunca se expone al cliente; solo se usa internamente.
   */
  async obtenerPorId(id: number): Promise<dt_documento> {
    const doc = await prisma.dt_documento.findUnique({
      where: { id_dt_documento: id },
    });

    if (!doc) {
      throw new ErrorNoEncontrado(`Documento con id ${id} no encontrado`);
    }

    if (!doc.estado) {
      throw new ErrorNegocio("El documento está inactivo");
    }

    return doc;
  },

  /**
   * Devuelve un ReadStream del archivo junto con los metadatos necesarios
   * para construir los headers HTTP (Content-Type, Content-Disposition, etc.)
   * sin exponer la ruta real en disco al cliente.
   *
   * El stream se crea con { highWaterMark: 64 * 1024 } (chunks de 64 KB)
   * para evitar cargar el archivo completo en memoria.
   */
  async obtenerStreamDescarga(id: number): Promise<StreamDescarga> {
    const doc = await DocumentoService.obtenerPorId(id);

    // Reconstruir la ruta absoluta desde la ruta relativa guardada en DB
    const rutaAbsoluta = path.resolve(doc.ruta);

    if (!fs.existsSync(rutaAbsoluta)) {
      throw new ErrorNoEncontrado(
        `El archivo físico del documento ${id} no fue encontrado en el servidor`
      );
    }

    const stream = fs.createReadStream(rutaAbsoluta, {
      highWaterMark: 64 * 1024, // chunks de 64 KB
    });

    return {
      stream,
      mimeType: doc.mime_type,
      nombreOriginal: doc.nombre_original,
      tamanioBytes: doc.tama_o_bytes,
    };
  },

  /**
   * Sube un único archivo:
   * 1. Verifica que el tipo de documento exista y esté activo
   * 2. Valida extensión contra extensiones_permitidas
   * 3. Valida tamaño contra max_size_bytes
   * 4. Calcula hash y detecta duplicados
   * 5. Escribe el archivo a disco
   * 6. Inserta el registro en dt_documento
   */
  async subirDocumento(dto: SubirDocumentoDto): Promise<dt_documento> {
    const { file, id_ct_tipo_documento, modulo, referencia_id, id_ct_usuario_in } = dto;

    // 1. Verificar que el tipo de documento exista
    const tipo = await prisma.ct_tipo_documento.findUnique({
      where: { id_ct_tipo_documento },
    });

    if (!tipo) {
      throw new ErrorNoEncontrado(
        `Tipo de documento con id ${id_ct_tipo_documento} no encontrado`
      );
    }

    if (!tipo.estado) {
      throw new ErrorNegocio(
        `El tipo de documento "${tipo.clave}" está inactivo`
      );
    }

    // 2. Validar extensión
    const extArchivo = obtenerExtension(file.originalname);
    const extensionesPermitidas = parsearExtensiones(tipo.extensiones_permitidas);

    if (!extensionesPermitidas.includes(extArchivo)) {
      throw new ErrorValidacion(
        `La extensión ".${extArchivo}" no está permitida para el tipo "${tipo.clave}". ` +
          `Extensiones permitidas: ${extensionesPermitidas.map((e) => `.${e}`).join(", ")}`
      );
    }

    // 3. Validar tamaño
    if (file.size > tipo.max_size_bytes) {
      const maxMb = (tipo.max_size_bytes / 1024 / 1024).toFixed(2);
      const archivoMb = (file.size / 1024 / 1024).toFixed(2);
      throw new ErrorValidacion(
        `El archivo excede el tamaño máximo permitido: ${archivoMb} MB de ${maxMb} MB`
      );
    }

    // 4. Detectar duplicado por hash SHA-256
    const hash = generarHash(file.buffer);

    const duplicado = await prisma.dt_documento.findUnique({
      where: { hash },
    });

    if (duplicado) {
      throw new ErrorNegocio(
        `El archivo "${file.originalname}" ya existe en el sistema (hash duplicado)`
      );
    }

    // 5. Escribir archivo a disco
    const nombreSistema = generarNombreSistema(file.originalname);
    const ruta = escribirArchivo(file.buffer, modulo, nombreSistema);

    // 6. Insertar en base de datos
    return prisma.dt_documento.create({
      data: {
        nombre_original: file.originalname,
        nombre_sistema: nombreSistema,
        ruta,
        mime_type: file.mimetype,
        tama_o_bytes: file.size,
        hash,
        id_ct_tipo_documento,
        modulo,
        referencia_id,
        id_ct_usuario_in,
      },
    });
  },

  /**
   * Sube múltiples archivos en secuencia.
   * Retorna resultados individuales por archivo (éxitos y errores granulares).
   * Se ejecuta en secuencia (no paralelo) para evitar race conditions en disco
   * y para que los errores de duplicado sean claros uno por uno.
   */
  async subirDocumentos(
    dtos: SubirDocumentoDto[]
  ): Promise<ResultadoSubida[]> {
    const resultados: ResultadoSubida[] = [];

    for (const dto of dtos) {
      try {
        const documento = await DocumentoService.subirDocumento(dto);
        resultados.push({ exito: true, documento });
      } catch (error) {
        resultados.push({
          exito: false,
          nombre: dto.file.originalname,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    return resultados;
  },
};
