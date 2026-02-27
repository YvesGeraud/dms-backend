import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import path from "path";

/**
 * Genera un hash SHA-256 del buffer de un archivo.
 * Se usa para detectar archivos duplicados antes de persistirlos.
 */
export function generarHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Extrae la extensión del nombre original de un archivo,
 * normalizada a lowercase y sin punto (ej. "pdf", "jpg").
 */
export function obtenerExtension(nombreOriginal: string): string {
  return path.extname(nombreOriginal).toLowerCase().replace(".", "");
}

/**
 * Genera un nombre de archivo único para almacenamiento en sistema,
 * usando UUID v4 + extensión original.
 * Ejemplo: "3f2504e0-4f89-11d3-9a0c-0305e82c3301.pdf"
 */
export function generarNombreSistema(nombreOriginal: string): string {
  const ext = obtenerExtension(nombreOriginal);
  return ext ? `${uuidv4()}.${ext}` : uuidv4();
}
