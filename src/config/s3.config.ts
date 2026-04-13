import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { config } from './servidor.config';

let s3Client: S3Client | null = null;

if (config.storageProvider === 's3') {
  if (!config.s3.region || !config.s3.bucket) {
    throw new Error('Las variables AWS_REGION y AWS_S3_BUCKET son requeridas cuando STORAGE_PROVIDER es s3');
  }

  const s3Config: S3ClientConfig = {
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
    },
    forcePathStyle: config.s3.forcePathStyle, // Necesario para MinIO u otros proveedores compatibles
  };

  if (config.s3.endpoint) {
    s3Config.endpoint = config.s3.endpoint;
  }

  s3Client = new S3Client(s3Config);
}

export { s3Client };
