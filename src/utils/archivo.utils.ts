import multer, { type FileFilterCallback, type StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { ErrorNoEncontrado, ErrorNegocio } from '@/utils/errores.utils';
import { config } from '@/config/servidor.config';

// ── MIME types conocidos ──────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

// Expresiones regulares reutilizables para tiposPermitidos
export const TIPOS = {
  IMAGENES: /^image\/(jpeg|png|webp|gif)$/,
  DOCUMENTOS: /^(application\/pdf|text\/plain|text\/csv)$/,
  EXCEL: /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/,
  /** Imágenes + PDF: útil para formularios con adjuntos */
  IMAGENES_PDF: /^(image\/(jpeg|png|webp)|application\/pdf)$/,
} as const;

// ── Directorio base de subidas ────────────────────────────────────────────────

export const UPLOADS_DIR = path.resolve(config.uploadPath);

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface OpcionesSubida {
  /**
   * Subdirectorio dentro de uploads/.
   * Permite organizar los archivos por módulo (ej: 'imagenes/platillos', 'documentos').
   * Default: 'general'
   */
  destino?: string;
  /**
   * Tamaño máximo en MB. Default: 5
   * Para imágenes de menú 2 MB es suficiente; para documentos 10–20 MB.
   */
  maxMB?: number;
  /**
   * Regex contra el MIME type reportado por el cliente.
   * Default: TIPOS.IMAGENES (solo jpeg, png, webp, gif)
   *
   * ⚠ El MIME type puede ser manipulado por el cliente.
   * Para mayor seguridad, valida también el magic number del archivo (file-type library).
   */
  tiposPermitidos?: RegExp;
  /** Número máximo de archivos por request (subida múltiple). Default: 1 */
  maxArchivos?: number;
}

// ── Factory de instancias Multer ──────────────────────────────────────────────

/**
 * Crea una instancia de Multer configurada para guardar en disco.
 *
 * El nombre del archivo se genera con 16 bytes aleatorios (hex) para:
 *   - Evitar colisiones entre usuarios con el mismo nombre de archivo
 *   - Prevenir ataques de path traversal con nombres como "../../etc/passwd"
 *   - Evitar sobrescribir archivos existentes
 *
 * @example
 * // Definir una sola vez por módulo
 * const subirImagen = crearSubidor({ destino: 'imagenes/platillos', maxMB: 2 });
 *
 * // Usar como middleware en la ruta
 * router.post('/platillos/:id/imagen',
 *   autenticado,
 *   autorizado('ADMIN'),
 *   subirImagen.single('imagen'),   // 'imagen' = nombre del campo en el form
 *   platilloController.subirImagen,
 * );
 *
 * // En el controlador:
 * async subirImagen(req: Request, res: Response) {
 *   if (!req.file) throw new ErrorNegocio('No se recibió ningún archivo');
 *   const rutaRelativa = req.file.path; // ej: uploads/imagenes/platillos/abc123.png
 *   await platilloService.actualizarImagen(Number(req.params.id), rutaRelativa);
 *   responder.ok(res, { imagen_url: rutaRelativa }, 'Imagen actualizada');
 * }
 */
export function crearSubidor(opciones: OpcionesSubida = {}) {
  const {
    destino = 'general',
    maxMB = 5,
    tiposPermitidos = TIPOS.IMAGENES,
    maxArchivos = 1,
  } = opciones;

  const dirDestino = path.join(UPLOADS_DIR, destino);

  // Crea el directorio al iniciar — no falla si ya existe
  fs.mkdirSync(dirDestino, { recursive: true });

  const storage: StorageEngine = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dirDestino),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const nombre = crypto.randomBytes(16).toString('hex');
      cb(null, `${nombre}${ext}`);
    },
  });

  const filtroMime = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (tiposPermitidos.test(file.mimetype)) {
      cb(null, true);
    } else {
      // El error llega al error middleware global como cualquier otro AppError
      cb(
        new ErrorNegocio(
          `Tipo de archivo no permitido: ${file.mimetype}. ` +
            `Se esperaba: ${tiposPermitidos.source}`,
        ),
      );
    }
  };

  return multer({
    storage,
    fileFilter: filtroMime,
    limits: {
      fileSize: maxMB * 1024 * 1024,
      files: maxArchivos,
    },
  });
}

// ── Descarga via stream ───────────────────────────────────────────────────────

/**
 * Envía un archivo al cliente usando un ReadStream para no cargarlo en memoria.
 * Incluye Content-Length para que el navegador muestre progreso de descarga.
 *
 * Ventaja sobre res.sendFile():
 *   - Control total sobre headers (Content-Disposition, tipo MIME)
 *   - Manejo de errores de stream integrado
 *   - Compatible con cualquier fuente (local, ruta construida, etc.)
 *
 * @param descargar  - true: fuerza descarga | false: muestra inline (PDF, imágenes)
 *
 * @throws ErrorNoEncontrado si el archivo no existe o no es legible
 *
 * @example
 * async obtenerImagen(req: Request, res: Response) {
 *   const ruta = path.join(UPLOADS_DIR, 'imagenes/platillos', req.params.nombre);
 *   await descargarArchivo(res, ruta, undefined, false); // inline
 * }
 *
 * @example
 * async descargarReporte(req: Request, res: Response) {
 *   const ruta = path.join(UPLOADS_DIR, 'reportes', req.params.archivo);
 *   await descargarArchivo(res, ruta, 'reporte-mensual.pdf'); // descarga forzada
 * }
 */
export async function descargarArchivo(
  res: Response,
  rutaArchivo: string,
  nombreDescarga?: string,
  descargar = true,
): Promise<void> {
  // Verificar que el archivo existe y es legible ANTES de abrir el stream
  // Convierte ENOENT a ErrorNoEncontrado para que el error middleware devuelva 404
  try {
    await fs.promises.access(rutaArchivo, fs.constants.R_OK);
  } catch {
    throw new ErrorNoEncontrado(`Archivo no encontrado: ${path.basename(rutaArchivo)}`);
  }

  const stats = await fs.promises.stat(rutaArchivo);
  const ext = path.extname(rutaArchivo).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const nombre = nombreDescarga ?? path.basename(rutaArchivo);

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader(
    'Content-Disposition',
    `${descargar ? 'attachment' : 'inline'}; filename="${encodeURIComponent(nombre)}"`,
  );

  const stream = fs.createReadStream(rutaArchivo);

  // Si el stream falla DESPUÉS de enviar headers, no podemos cambiar el status code.
  // Destruimos la conexión para que el cliente no reciba datos corruptos ni un body vacío.
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });

  stream.pipe(res);
}

// ── Deduplicación por hash de contenido ──────────────────────────────────────

export interface ResultadoDeduplicacion {
  /** Ruta absoluta final del archivo (canónica basada en hash) */
  ruta: string;
  /** SHA-256 del contenido del archivo en hexadecimal */
  hash: string;
  /** true si el archivo ya existía (misma imagen con distinto nombre) */
  duplicado: boolean;
}

/**
 * Calcula el hash SHA-256 de un archivo mediante ReadStream.
 * No carga el archivo completo en memoria — ideal para archivos grandes.
 */
export function calcularHashArchivo(rutaArchivo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(rutaArchivo);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Deduplica un archivo recién subido comparando su contenido (SHA-256),
 * no el nombre. Si el mismo contenido ya existe en disco, elimina el temporal
 * y devuelve la ruta canónica existente.
 *
 * Ventaja: dos usuarios que suban la misma foto con distinto nombre
 * comparten un único archivo en disco — ahorro de espacio garantizado.
 *
 * Flujo:
 *   1. Calcula hash SHA-256 del archivo temporal (via stream, sin cargar en RAM)
 *   2. Construye la ruta canónica: {directorio}/{hash}{ext}
 *   3a. Si ya existe → elimina temporal → devuelve existente (duplicado: true)
 *   3b. Si no existe → renombra temporal a ruta canónica (duplicado: false)
 *
 * @param rutaTemporal  - Ruta del archivo guardado por Multer (nombre aleatorio)
 * @param directorio    - Directorio donde quedará el archivo final
 */
export async function deduplicarArchivo(
  rutaTemporal: string,
  directorio: string,
): Promise<ResultadoDeduplicacion> {
  const hash = await calcularHashArchivo(rutaTemporal);
  const ext = path.extname(rutaTemporal).toLowerCase();
  const rutaCanonica = path.join(directorio, `${hash}${ext}`);

  const yaExiste = await fs.promises
    .access(rutaCanonica, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (yaExiste) {
    // Mismo contenido: borrar el temporal y devolver el existente
    await fs.promises.unlink(rutaTemporal);
    return { ruta: rutaCanonica, hash, duplicado: true };
  }

  // Contenido nuevo: mover el temporal a la ubicación canónica
  await fs.promises.rename(rutaTemporal, rutaCanonica);
  return { ruta: rutaCanonica, hash, duplicado: false };
}

// ── Utilidades de gestión ─────────────────────────────────────────────────────

/**
 * Elimina un archivo del disco de forma asíncrona.
 * No lanza error si el archivo ya no existe (operación idempotente).
 *
 * @example
 * // Al actualizar imagen: borrar la anterior antes de guardar la nueva
 * if (platillo.imagen_url) {
 *   await eliminarArchivo(platillo.imagen_url);
 * }
 */
export async function eliminarArchivo(rutaArchivo: string): Promise<void> {
  try {
    await fs.promises.unlink(rutaArchivo);
  } catch (err) {
    // ENOENT = el archivo ya no existe, no es un error real para esta operación
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/**
 * Construye la ruta absoluta de un archivo dentro de uploads/.
 * Útil para no repetir path.join(UPLOADS_DIR, ...) en cada servicio.
 *
 * @example
 * const ruta = rutaArchivo('imagenes/platillos', archivo.filename);
 * // → /ruta/absoluta/uploads/imagenes/platillos/abc123.png
 */
export function rutaEnUploads(...segmentos: string[]): string {
  return path.join(UPLOADS_DIR, ...segmentos);
}

// ── Validación dinámica (dt_documento) ───────────────────────────────────────
//
// Estas funciones se usan cuando las reglas de validación vienen de la BD
// (tabla ct_tipo_documento) en lugar de estar hardcodeadas en tiempo de compilación.

/**
 * Mapa de extensión de archivo → MIME type oficial.
 * Extiende el MIME_TYPES interno con formatos adicionales de oficina.
 */
export const EXTENSION_A_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Forma que expone Prisma para el registro de ct_tipo_documento.
 * Solo los campos que necesita la validación — evita importar el cliente Prisma aquí.
 */
export interface TipoDocumentoParaValidar {
  max_size_bytes: number;
  extensiones_permitidas: string; // ej: "pdf,jpg,png"  (sin puntos)
  descripcion: string;
}

/**
 * Valida que el archivo sea compatible con las reglas del tipo de documento.
 *
 * Comprueba dos cosas:
 *   1. La extensión del nombre original está en `extensiones_permitidas`
 *   2. El tamaño no supera `max_size_bytes`
 *
 * Usa la extensión del nombre del archivo (no el MIME type del cliente)
 * porque en memoryStorage el MIME lo declara el cliente y puede ser falso;
 * la extensión combinada con la firma del archivo es más confiable.
 *
 * @throws ErrorNegocio con mensaje descriptivo si la validación falla
 *
 * @example
 * const tipo = await prisma.ct_tipo_documento.findUnique(...);
 * validarArchivoContraTipo(req.file, tipo);  // lanza si inválido
 */
export function validarArchivoContraTipo(
  archivo: Express.Multer.File,
  tipo: TipoDocumentoParaValidar,
): void {
  // Extrae los nombres de extensión con regex sin importar el formato guardado en BD:
  // funciona con JSON array (["jpg","pdf"]), CSV (jpg,pdf), con o sin puntos/comillas.
  const tokens = tipo.extensiones_permitidas.match(/[a-zA-Z0-9]+/g) ?? [];
  const permitidas = tokens.map((e) => `.${e.toLowerCase()}`);

  const extArchivo = path.extname(archivo.originalname).toLowerCase();

  if (!permitidas.includes(extArchivo)) {
    throw new ErrorNegocio(
      `El tipo de documento "${tipo.descripcion}" no permite archivos ${extArchivo}. ` +
        `Extensiones válidas: ${permitidas.join(', ')}`,
    );
  }

  if (archivo.size > tipo.max_size_bytes) {
    const maxMB = (tipo.max_size_bytes / (1024 * 1024)).toFixed(1);
    const recMB = (archivo.size / (1024 * 1024)).toFixed(1);
    throw new ErrorNegocio(
      `El archivo supera el tamaño máximo permitido para "${tipo.descripcion}". ` +
        `Máximo: ${maxMB} MB, recibido: ${recMB} MB`,
    );
  }
}

/**
 * Calcula el hash SHA-256 de un Buffer en memoria.
 * Versión síncrona y directa — ideal cuando el archivo ya está en RAM (memoryStorage).
 */
export function calcularHashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Resuelve la ruta absoluta del directorio destino según el módulo y el id de la persona.
 * Crea el directorio si no existe (operación idempotente).
 *
 * @param moduloCampo - Nombre del módulo almacenado en BD (ej: "comun", "Proni")
 * @param idUsuario   - Id del usuario (se convierte en nombre de subcarpeta final)
 * @returns Ruta absoluta del directorio destino
 */
export function resolverRutaModulo(moduloCampo: string, idUsuario: number): string {
  const mod = moduloCampo.trim();

  if (!mod) {
    throw new ErrorNegocio('El tipo de documento no tiene un módulo válido asignado.');
  }

  // Regla de carpetas:
  // - Si el módulo es "comun", va a uploads/comun/{idUsuario}
  // - Si es ajeno a comun (ej. "Proni"), va a uploads/sistema/{modulo}/{idUsuario}
  const segmentos = mod.toLowerCase() === 'comun' ? ['comun'] : ['sistema', mod];

  const directorio = path.join(UPLOADS_DIR, ...segmentos, String(idUsuario));
  fs.mkdirSync(directorio, { recursive: true });
  return directorio;
}

/**
 * Escribe un Buffer desde memoria a disco.
 * Si ya existe un archivo con el mismo nombre (mismo hash), no lo sobreescribe.
 *
 * @returns Objeto con ruta final y si fue duplicado
 */
export async function guardarArchivoDesdeMemoria(
  buffer: Buffer,
  directorio: string,
  nombreArchivo: string,
): Promise<{ ruta: string; duplicado: boolean }> {
  const ruta = path.join(directorio, nombreArchivo);

  const yaExiste = await fs.promises
    .access(ruta, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (yaExiste) {
    return { ruta, duplicado: true };
  }

  await fs.promises.writeFile(ruta, buffer);
  return { ruta, duplicado: false };
}
/**
 * Comprime un listado de archivos en un stream ZIP y lo envía a la Response.
 * Ideal para "Descargar todo" sin crear archivos temporales en el servidor.
 *
 * Usa compresión zlib nivel 1 (rápida) para soportar lotes grandes (1700+ archivos)
 * sin bloquear el event loop por mucho tiempo.
 *
 * @param res                   - Respuesta de Express
 * @param archivos              - Lista de objetos con ruta absoluta y nombre deseado en el ZIP
 * @param nombreZip             - Nombre del archivo .zip final (sin extensión)
 * @param hashesNoEncontrados   - Hashes que no se encontraron en BD (se incluyen como manifiesto)
 */
export async function comprimirArchivos(
  res: Response,
  archivos: { rutaAbsoluta: string; nombreDeseado: string; isS3?: boolean; s3Key?: string }[],
  nombreZip: string,
  hashesNoEncontrados: string[] = [],
): Promise<void> {
  const archiver = (await import('archiver')).default;

  // Nivel 1: compresión rápida. Con 1700 archivos, level 9 sería ~10x más lento
  // y la diferencia de tamaño es mínima (~5-10% menos con level 9).
  const archive = archiver('zip', { zlib: { level: 1 } });

  // Configurar headers para descarga de archivo binario
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(nombreZip)}.zip"`,
  );

  // Manejar errores del stream de archiver para evitar que la respuesta quede colgada
  archive.on('error', (err) => {
    console.error('[ZIP] Error al comprimir archivos:', err);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy();
    }
  });

  // Manejar cierre prematuro del cliente (ej: cancelación de descarga)
  res.on('close', () => {
    if (!archive.closed) {
      archive.abort();
    }
  });

  // Pipe del archivo comprimido a la respuesta
  archive.pipe(res);

  for (const item of archivos) {
    try {
      if (item.isS3 && item.s3Key) {
        const { obtenerStreamDeS3 } = await import('@/utils/s3.utils');
        const stream = await obtenerStreamDeS3(item.s3Key);
        archive.append(stream, { name: item.nombreDeseado });
      } else {
        // Verificar acceso antes de añadir al zip
        await fs.promises.access(item.rutaAbsoluta, fs.constants.R_OK);
        archive.file(item.rutaAbsoluta, { name: item.nombreDeseado });
      }
    } catch (err) {
      // Si un archivo falta, lo omitimos (o podríamos añadir un .txt avisando)
      console.error(`No se pudo acceder a ${item.nombreDeseado}:`, err);
    }
  }

  // Si hay hashes no encontrados, incluir un manifiesto informativo en el ZIP
  if (hashesNoEncontrados.length > 0) {
    const contenido = [
      `=== MANIFIESTO DE DESCARGA BATCH ===`,
      `Fecha: ${new Date().toISOString()}`,
      `Total solicitados: ${archivos.length + hashesNoEncontrados.length}`,
      `Total descargados: ${archivos.length}`,
      `No encontrados: ${hashesNoEncontrados.length}`,
      ``,
      `--- Hashes no encontrados ---`,
      ...hashesNoEncontrados,
    ].join('\n');

    archive.append(contenido, { name: '_manifiesto_errores.txt' });
  }

  // Finalizar el stream
  await archive.finalize();
}

