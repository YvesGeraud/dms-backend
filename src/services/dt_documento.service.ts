import path from 'path';
import type { ct_tipo_documento, dt_documento } from '@/generated/prisma/client.js';
import { prisma } from '@/config/database.config.js';
import { buscarOError } from '@/utils/prisma.utils.js';
import {
  validarArchivoContraTipo,
  calcularHashBuffer,
  resolverRutaModulo,
  guardarArchivoDesdeMemoria,
  EXTENSION_A_MIME,
  MODULOS_CARPETA,
} from '@/utils/archivo.utils.js';
import type { SubirDocumentoDTO } from '@/schemas/dt_documento.schemas.js';

// ── Servicio ──────────────────────────────────────────────────────────────────

class DtDocumentoService {
  /**
   * Sube un documento al sistema:
   *   1. Valida que el tipo de documento existe y está activo
   *   2. Valida que el archivo cumple las reglas del tipo (ext + tamaño)
   *   3. Resuelve y crea la carpeta destino según el módulo y el rupeet
   *   4. Calcula el hash SHA-256 del archivo (deduplicación)
   *   5. Si el hash ya existe en BD, reutiliza el registro pero igual escribe el
   *      archivo en la carpeta del módulo/rupeet actual (evita carpeta vacía).
   *   6. Si es contenido nuevo: persiste el registro en dt_documento
   *
   * @param datos      - IDs validados por Zod desde el body multipart
   * @param archivo    - Archivo en memoria (memoryStorage de Multer)
   * @param idUsuario  - Id del usuario autenticado (hardcodeado en 1 hasta JWT)
   */
  async subirDocumento(datos: SubirDocumentoDTO, archivo: Express.Multer.File, idUsuario: number) {
    // ── 1. Verificar que el tipo de documento existe y está activo ───────────
    const tipodoc = await buscarOError<ct_tipo_documento>(
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
    const directorio = resolverRutaModulo(datos.id_ct_modulo, datos.id_ct_rupeet);

    // ── 4. Calcular hash SHA-256 del buffer ──────────────────────────────────
    const hash = calcularHashBuffer(archivo.buffer);
    const ext = path.extname(archivo.originalname).toLowerCase();

    // El nombre en sistema es {hash}{ext} — garantiza unicidad por contenido
    const nombreSistema = `${hash}${ext}`;

    // ── 5. Deduplicación en BD: si ya existe un registro activo con el mismo
    //       hash, reutilizamos ese registro (un solo dt_documento por contenido).
    //       Aun así debemos asegurar el archivo en disco en la carpeta de ESTE
    //       módulo/rupeet: si no, la segunda subida del mismo archivo no dejaba
    //       copia en uploads/sistema/Proni/{rupeet}/ y parecía "no guardar".
    const existente = await prisma.dt_documento.findFirst({
      where: { hash, estado: true },
    });

    // ── 6. Escribir a disco (siempre que haya buffer: nuevo o duplicado en BD) ─
    const { ruta } = await guardarArchivoDesdeMemoria(archivo.buffer, directorio, nombreSistema);

    if (existente) {
      return { ...existente, duplicado: true };
    }

    // Ruta relativa desde la raíz del proyecto (para portabilidad entre entornos)
    // Ej: uploads/comun/3/abc123...def.pdf
    const rutaRelativa = path.relative(process.cwd(), ruta).replace(/\\/g, '/');

    // Nombre del módulo para el campo modulo en BD (último segmento de la carpeta)
    const segmentos = MODULOS_CARPETA[datos.id_ct_modulo];
    const nombreModulo = segmentos[segmentos.length - 1];

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
        modulo: nombreModulo,
        id_ct_usuario_in: idUsuario,
      },
    });

    return { ...documento, duplicado: false };
  }

  /**
   * Localiza un documento en BD y retorna su ruta absoluta para streaming.
   *
   * @param id - id_dt_documento
   * @returns El registro completo + la ruta absoluta del archivo en disco
   * @throws ErrorNoEncontrado si el id no existe o el documento está inactivo
   */
  async obtenerParaDescarga(id: number) {
    const doc = await buscarOError<dt_documento>(
      prisma.dt_documento.findFirst({
        where: { id_dt_documento: id, estado: true },
      }),
      'dt_documento',
    );

    // ruta_relativa se guardó con barras "/" (portable). Para el FS local:
    const rutaAbsoluta = path.resolve(doc.ruta_relativa);

    return { doc, rutaAbsoluta };
  }
}

export default new DtDocumentoService();
