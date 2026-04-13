import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { s3Client } from '@/config/s3.config';
import { config } from '@/config/servidor.config';

/**
 * Sube un buffer a S3.
 *
 * @param buffer - Buffer del archivo
 * @param mimeType - MIME Type del archivo
 * @param objectKey - Llave única del objeto (ej. uploads/comun/3/abc.pdf)
 * @returns La llave (objectKey) subida
 */
export async function guardarArchivoEnS3(
  buffer: Buffer,
  mimeType: string,
  objectKey: string,
): Promise<string> {
  if (!s3Client || !config.s3.bucket) {
    throw new Error('El cliente S3 no está configurado correctamente.');
  }

  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return objectKey;
}

/**
 * Genera una Pre-Signed URL para descarga directa desde el bucket S3.
 *
 * @param objectKey - Llave del objeto en S3
 * @param nombreDescarga - El nombre con el que el archivo se guardará al descargar
 * @param inline - Si es true, añade inline para visualización en navegador en lugar de descarga forzada
 * @param expiracionSegundos - Tiempo de validez del enlace (por defecto 15 minutos)
 */
export async function obtenerPreSignedUrl(
  objectKey: string,
  nombreDescarga: string,
  inline = false,
  expiracionSegundos = 900,
): Promise<string> {
  if (!s3Client || !config.s3.bucket) {
    throw new Error('El cliente S3 no está configurado correctamente.');
  }

  // Content-Disposition inline muestra PDF e imágenes en el navegador; attachment fuerza la descarga
  const dispositionType = inline ? 'inline' : 'attachment';
  const responseContentDisposition = `${dispositionType}; filename="${encodeURIComponent(
    nombreDescarga,
  )}"`;

  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: objectKey,
    ResponseContentDisposition: responseContentDisposition,
  });

  // Generar URL válida
  const url = await getSignedUrl(s3Client, command, { expiresIn: expiracionSegundos });
  return url;
}

/**
 * Obtiene el Stream de lectura de un objeto en S3. Útil para comprimir en memoria (ZIP)
 * sin guardar el archivo en disco ni pasarlo por presigned urls públicas.
 */
export async function obtenerStreamDeS3(objectKey: string): Promise<Readable> {
  if (!s3Client || !config.s3.bucket) {
    throw new Error('El cliente S3 no está configurado correctamente.');
  }

  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: objectKey,
  });

  const response = await s3Client.send(command);
  
  // response.Body es un stream (Readable en Node.js)
  if (!response.Body) {
    throw new Error(`El objeto ${objectKey} no pudo ser recuperado desde S3.`);
  }
  
  return response.Body as unknown as Readable;
}
