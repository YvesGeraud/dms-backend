import path from 'path';
import { prisma } from '@/config/database.config';
import { buscarOError } from '@/utils/prisma.utils';
import {
  validarArchivoContraTipo,
  calcularHashBuffer,
  resolverRutaModulo,
  guardarArchivoDesdeMemoria,
  EXTENSION_A_MIME,
} from '@/utils/archivo.utils';
import { config } from '@/config/servidor.config';
import type { SubirDocumentoDTO } from '@/schemas/dt_documento.schemas';

// ── Servicio ──────────────────────────────────────────────────────────────────

class DtDocumentoService {
  /**
   * Sube un documento al sistema:
   *   1. Valida que el tipo de documento existe y está activo
   *   2. Valida que el archivo cumple las reglas del tipo (ext + tamaño)
   *   3. Resuelve y crea la carpeta destino según el módulo y el rupeet
   *   4. Calcula el hash SHA-256 del archivo (deduplicación)
   *   5. Escribe en disco (omite escritura si es duplicado)
   *   6. Persiste el registro en dt_documento
   *
   * @param datos      - IDs validados por Zod desde el body multipart
   * @param archivo    - Archivo en memoria (memoryStorage de Multer)
   * @param idUsuario  - Id del usuario autenticado (hardcodeado en 1 hasta JWT)
   */
  async subirDocumento(datos: SubirDocumentoDTO, archivo: Express.Multer.File, idUsuario: number) {
    // ── 1. Verificar que el tipo de documento existe y está activo ───────────
    const tipodoc = await buscarOError(
      prisma.ct_tipo_documento.findFirst({
        where: {
          id_ct_tipo_documento: datos.id_ct_tipo_documento,
          estado: true,
        },
      }),
      'ct_tipo_documento',
    );

    // ── 2. Validar el archivo contra las reglas del tipo ─────────────────────
    //    Lanza ErrorNegocio si la extensión o tamaño no son válidos
    validarArchivoContraTipo(archivo, tipodoc);


    // ── 4. Calcular hash SHA-256 del buffer ──────────────────────────────────
    const hash = calcularHashBuffer(archivo.buffer);
    const ext = path.extname(archivo.originalname).toLowerCase();

    // El nombre en sistema es {hash}{ext} — garantiza unicidad por contenido
    const nombreSistema = `${hash}${ext}`;

    // ── 5. Deduplicación en BD: si ya existe un registro activo con el mismo
    //       hash, retornamos ese directamente sin tocar disco ni insertar nada.
    //       Si existe pero está inactivo (estado=false), continuamos normalmente.
    const existente = await prisma.dt_documento.findFirst({
      where: { hash, estado: true },
    });

    if (existente) {
      return { ...existente, duplicado: true };
    }

    // ── 6. Escribir a almacenamiento (solo si el contenido es nuevo) ────────────
    const mimeType = EXTENSION_A_MIME[ext] ?? archivo.mimetype;
    let rutaRelativa = '';

    if (config.storageProvider === 's3') {
      const { guardarArchivoEnS3 } = await import('@/utils/s3.utils');
      // S3 object key format: modulo/idUsuario/archivo
      const modLimpio = tipodoc.modulo.toLowerCase().replace(/\s+/g, '_');
      const s3Prefix = modLimpio === 'comun' ? 'comun' : `sistema/${modLimpio}`;
      const objectKey = `${s3Prefix}/${datos.id_ct_usuario}/${nombreSistema}`;
      
      await guardarArchivoEnS3(archivo.buffer, mimeType, objectKey);
      rutaRelativa = objectKey;
    } else {
      const directorio = resolverRutaModulo(tipodoc.modulo, datos.id_ct_usuario);
      const { ruta } = await guardarArchivoDesdeMemoria(archivo.buffer, directorio, nombreSistema);
      rutaRelativa = path.relative(process.cwd(), ruta).replace(/\\/g, '/');
    }

    // ── 7. Persistir en dt_documento ─────────────────────────────────────────
    const documento = await prisma.dt_documento.create({
      data: {
        nombre_original: archivo.originalname,
        nombre_sistema: nombreSistema,
        ruta_relativa: rutaRelativa,
        mime_type: mimeType,
        tama_o_bytes: archivo.size,
        hash,
        storage_provider: config.storageProvider,
        id_ct_tipo_documento: datos.id_ct_tipo_documento,
        id_ct_usuario: datos.id_ct_usuario,
        id_ct_usuario_in: idUsuario,
      },
    });

    return { ...documento, duplicado: false };
  }

  /**
   * Sube un lote de archivos al sistema.
   *
   * Mejoras respecto a Promise.all original:
   *   - Consulta ct_tipo_documento UNA sola vez para todos los archivos (evita N queries)
   *   - Usa Promise.allSettled para que un archivo fallido no cancele los demás
   *   - Retorna resultados individuales: éxito o error por archivo
   *
   * @param datos      - IDs comunes (mismo tipo de documento y usuario para todos)
   * @param archivos   - Array de archivos en memoria
   * @param idUsuario  - Id del usuario que sube los archivos
   */
  async subirDocumentosBatch(
    datos: SubirDocumentoDTO,
    archivos: Express.Multer.File[],
    idUsuario: number,
  ) {
    const tipodoc = await buscarOError(
      prisma.ct_tipo_documento.findFirst({
        where: { id_ct_tipo_documento: datos.id_ct_tipo_documento, estado: true },
      }),
      'ct_tipo_documento',
    );

    const resultados = await Promise.allSettled(
      archivos.map((archivo) => this._subirConTipo(datos, archivo, idUsuario, tipodoc)),
    );

    return resultados.map((r, i) => {
      const nombreArchivo = archivos[i]!.originalname;
      if (r.status === 'fulfilled') {
        return { exito: true, archivo: nombreArchivo, documento: r.value };
      }
      return {
        exito: false,
        archivo: nombreArchivo,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });
  }

  /**
   * Sube un único archivo dado su tipo ya validado desde BD.
   * Método interno — usar subirDocumento (tipo desde BD) o subirDocumentosBatch.
   */
  private async _subirConTipo(
    datos: SubirDocumentoDTO,
    archivo: Express.Multer.File,
    idUsuario: number,
    tipodoc: { modulo: string; max_size_bytes: number; extensiones_permitidas: string; descripcion: string },
  ) {
    validarArchivoContraTipo(archivo, tipodoc);

    const hash = calcularHashBuffer(archivo.buffer);
    const ext = path.extname(archivo.originalname).toLowerCase();
    const nombreSistema = `${hash}${ext}`;

    const existente = await prisma.dt_documento.findFirst({
      where: { hash, estado: true },
    });
    if (existente) return { ...existente, duplicado: true };

    const mimeType = EXTENSION_A_MIME[ext] ?? archivo.mimetype;
    let rutaRelativa = '';

    if (config.storageProvider === 's3') {
      const { guardarArchivoEnS3 } = await import('@/utils/s3.utils');
      const modLimpio = tipodoc.modulo.toLowerCase().replace(/\s+/g, '_');
      const s3Prefix = modLimpio === 'comun' ? 'comun' : `sistema/${modLimpio}`;
      const objectKey = `${s3Prefix}/${datos.id_ct_usuario}/${nombreSistema}`;
      await guardarArchivoEnS3(archivo.buffer, mimeType, objectKey);
      rutaRelativa = objectKey;
    } else {
      const directorio = resolverRutaModulo(tipodoc.modulo, datos.id_ct_usuario);
      const { ruta } = await guardarArchivoDesdeMemoria(archivo.buffer, directorio, nombreSistema);
      rutaRelativa = path.relative(process.cwd(), ruta).replace(/\\/g, '/');
    }

    const documento = await prisma.dt_documento.create({
      data: {
        nombre_original: archivo.originalname,
        nombre_sistema: nombreSistema,
        ruta_relativa: rutaRelativa,
        mime_type: mimeType,
        tama_o_bytes: archivo.size,
        hash,
        storage_provider: config.storageProvider,
        id_ct_tipo_documento: datos.id_ct_tipo_documento,
        id_ct_usuario: datos.id_ct_usuario,
        id_ct_usuario_in: idUsuario,
      },
    });

    return { ...documento, duplicado: false };
  }

  /**
   * Localiza un documento en BD y retorna su ruta absoluta para streaming.
   *
   * @param hash - hash del documento
   * @returns El registro completo + la ruta absoluta del archivo en disco
   * @throws ErrorNoEncontrado si el hash no existe o el documento está inactivo
   */
  async obtenerParaDescarga(hash: string) {
    const doc = await buscarOError(
      prisma.dt_documento.findFirst({
        where: { hash, estado: true },
      }),
      'dt_documento',
    );

    // Para el FS local: path absoluto, para S3: devuelve la misma llave relativa (ObjectKey)
    const rutaAbsoluta = doc.storage_provider === 'local' 
      ? path.resolve(doc.ruta_relativa) 
      : doc.ruta_relativa;

    return { doc, rutaAbsoluta };
  }

  /**
   * Obtiene todos los documentos de un tipo específico y con un estado determinado.
   *
   * @param idTipo - Id del tipo de documento
   * @param estado - Filtro por estado activo/inactivo (default: true)
   * @returns Listado de documentos con rutas absolutas
   */
  async obtenerPorTipoYEstado(idTipo: number | number[], estado = true) {
    const ids = Array.isArray(idTipo) ? idTipo : [idTipo];

    const documentos = await prisma.dt_documento.findMany({
      where: {
        id_ct_tipo_documento: { in: ids },
        estado,
      },
      include: {
        ct_tipo_documento: {
          select: { modulo: true, descripcion: true },
        },
      },
    });

    return documentos.map((doc) => ({
      ...doc,
      rutaAbsoluta: doc.storage_provider === 'local' ? path.resolve(doc.ruta_relativa) : doc.ruta_relativa,
      isS3: doc.storage_provider === 's3',
      s3Key: doc.storage_provider === 's3' ? doc.ruta_relativa : undefined,
    }));
  }

  /**
   * Obtiene documentos por un listado masivo de hashes (soporta 1700+).
   *
   * Divide la consulta en chunks de 500 para no saturar el `IN(...)` de MySQL,
   * y reporta qué hashes no fueron encontrados para incluirlos en un manifiesto.
   *
   * @param hashes  - Array de hashes SHA-256 a buscar
   * @param estado  - Filtro por estado activo/inactivo (default: true)
   * @returns Documentos encontrados con rutas absolutas + lista de hashes no encontrados
   */
  async obtenerPorHashes(hashes: string[], estado = true) {
    const CHUNK_SIZE = 500;
    const todosLosDocumentos: Awaited<ReturnType<typeof this._buscarChunkHashes>>= [];

    // Dividir en chunks para no sobrecargar el IN(...)
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      const chunk = hashes.slice(i, i + CHUNK_SIZE);
      const resultados = await this._buscarChunkHashes(chunk, estado);
      todosLosDocumentos.push(...resultados);
    }

    // Determinar cuáles hashes no se encontraron
    const hashesEncontrados = new Set(todosLosDocumentos.map((d) => d.hash));
    const hashesNoEncontrados = hashes.filter((h) => !hashesEncontrados.has(h));

    return { documentos: todosLosDocumentos, hashesNoEncontrados };
  }

  /**
   * Busca un chunk de hashes en BD y retorna los documentos con rutas absolutas.
   * Método interno — no llamar directamente, usar `obtenerPorHashes`.
   */
  private async _buscarChunkHashes(hashes: string[], estado: boolean) {
    const documentos = await prisma.dt_documento.findMany({
      where: {
        hash: { in: hashes },
        estado,
      },
      include: {
        ct_tipo_documento: {
          select: { modulo: true, descripcion: true },
        },
      },
    });

    return documentos.map((doc) => ({
      ...doc,
      rutaAbsoluta: doc.storage_provider === 'local' ? path.resolve(doc.ruta_relativa) : doc.ruta_relativa,
      isS3: doc.storage_provider === 's3',
      s3Key: doc.storage_provider === 's3' ? doc.ruta_relativa : undefined,
    }));
  }

  /**
   * Realiza un borrado lógico (estado = false) de un documento por su hash.
   *
   * @param hash - hash del documento
   * @throws ErrorNoEncontrado si el hash no existe
   */
  async desactivarPorHash(hash: string) {
    const doc = await buscarOError(
      prisma.dt_documento.findFirst({
        where: { hash, estado: true },
      }),
      'dt_documento',
    );

    return prisma.dt_documento.update({
      where: { id_dt_documento: doc.id_dt_documento },
      data: { estado: false, fecha_up: new Date() },
    });
  }
}

export default new DtDocumentoService();
