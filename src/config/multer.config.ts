import multer from "multer";
import { ErrorValidacion } from "@/utils/errores.utils";

/**
 * Límite global de tamaño de archivo (techo de red).
 * Las validaciones de negocio reales (por tipo de documento) se hacen en el servicio.
 * Default: 50 MB.
 */
const LIMITE_GLOBAL_BYTES =
  parseInt(process.env["MAX_FILE_SIZE_BYTES"] ?? "0") || 50 * 1024 * 1024;

/**
 * Máximo de archivos permitidos en una sola petición multi-archivo.
 */
const MAX_ARCHIVOS = parseInt(process.env["MAX_FILES_PER_REQUEST"] ?? "0") || 10;

/**
 * Usamos memoryStorage para recibir el buffer en memoria y poder:
 *  - Calcular el hash SHA-256 antes de escribir a disco.
 *  - Validar extensión y tamaño contra ct_tipo_documento en el servicio.
 *  - Decidir si escribir o rechazar sin dejar archivos huérfanos en disco.
 */
const storage = multer.memoryStorage();

/**
 * Filtro mínimo: rechaza la petición si el archivo no llega con ningún mimetype.
 * Las validaciones de extensión reales las ejecuta el servicio.
 */
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!file.mimetype) {
    return cb(new ErrorValidacion("El archivo no tiene un tipo MIME válido"));
  }
  cb(null, true);
};

const instancia = multer({
  storage,
  limits: { fileSize: LIMITE_GLOBAL_BYTES, files: MAX_ARCHIVOS },
  fileFilter,
});

/** Middleware para subir un único archivo en el campo "archivo" */
export const subirUno = instancia.single("archivo");

/** Middleware para subir múltiples archivos en el campo "archivos" */
export const subirVarios = instancia.array("archivos", MAX_ARCHIVOS);
