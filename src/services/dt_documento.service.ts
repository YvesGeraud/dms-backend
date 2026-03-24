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

    // ── 3. Resolver la ruta destino según el módulo + rupeet ─────────────────
    //    Crea la carpeta si no existe (mkdirSync recursive)
    //    El nombre de módulo o carpeta (ej: "comun" o "sistema/Proni") viene en tipodoc.modulo
    const directorio = resolverRutaModulo(tipodoc.modulo, datos.id_ct_usuario);

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

    // ── 6. Escribir a disco (solo si el contenido es nuevo en BD) ────────────
    const { ruta } = await guardarArchivoDesdeMemoria(archivo.buffer, directorio, nombreSistema);

    // Ruta relativa desde la raíz del proyecto (para portabilidad entre entornos)
    // Ej: uploads/comun/3/abc123...def.pdf
    const rutaRelativa = path.relative(process.cwd(), ruta).replace(/\\/g, '/');

    // MIME type derivado de la extensión
    const mimeType = EXTENSION_A_MIME[ext] ?? archivo.mimetype;

    // ── 7. Persistir en dt_documento ─────────────────────────────────────────
    const documento = await prisma.dt_documento.create({
      data: {
        nombre_original: archivo.originalname,
        nombre_sistema: nombreSistema,
        ruta_relativa: rutaRelativa,
        mime_type: mimeType,
        tama_o_bytes: archivo.size,
        hash,
        id_ct_tipo_documento: datos.id_ct_tipo_documento,
        id_ct_usuario_in: idUsuario,
      },
    });

    return { ...documento, duplicado: false };
  }

  /**
   * Sube un lote de archivos al sistema.
   * Ejecuta subidas individuales en paralelo, reutilizando la validación
   * y deduplicación por archivo. Si alguno falla (ej. extensión inválida),
   * Express manejará el error e interrumpirá la ejecución.
   *
   * @param datos      - IDs comunes (mismo tipo de documento y usuario para todos)
   * @param archivos   - Array de archivos en memoria
   * @param idUsuario  - Id del usuario que sube los archivos
   */
  async subirDocumentosBatch(
    datos: SubirDocumentoDTO,
    archivos: Express.Multer.File[],
    idUsuario: number
  ) {
    // Si necesitas validar el tipo de documento una sola vez para ahorro de CPU/DB,
    // podrías refactorizar `subirDocumento` para inyectar `tipodoc`.
    // Por simplicidad y reuso total, ejecutamos en Promise.all:
    const operaciones = archivos.map((archivo) =>
      this.subirDocumento(datos, archivo, idUsuario)
    );

    // Se ejecutan las subidas concurrentemente
    return Promise.all(operaciones);
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

    // ruta_relativa se guardó con barras "/" (portable). Para el FS local:
    const rutaAbsoluta = path.resolve(doc.ruta_relativa);

    return { doc, rutaAbsoluta };
  }
}

export default new DtDocumentoService();
