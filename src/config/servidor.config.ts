type NodeEnv = 'development' | 'test' | 'production';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(`Variable de entorno requerida: ${nombre}`);
  }
  return valor;
}

function opcional(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor && valor.trim() !== '' ? valor : porDefecto;
}

function numero(nombre: string, porDefecto?: number): number {
  const raw = process.env[nombre];

  if (!raw || raw.trim() === '') {
    if (porDefecto === undefined) throw new Error(`Variable de entorno requerida: ${nombre}`);
    return porDefecto;
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Variable de entorno ${nombre} debe ser número. Recibido: "${raw}"`);
  }
  return n;
}

function unoDe<T extends string>(nombre: string, permitidos: readonly T[], porDefecto?: T): T {
  const raw = process.env[nombre];
  if (!raw || raw.trim() === '') {
    if (porDefecto === undefined) throw new Error(`Variable de entorno requerida: ${nombre}`);
    return porDefecto;
  }
  if (!permitidos.includes(raw as T)) {
    throw new Error(
      `Variable de entorno ${nombre} inválida. Permitidos: ${permitidos.join(', ')}. Recibido: "${raw}"`,
    );
  }
  return raw as T;
}

const nodeEnv = unoDe<NodeEnv>(
  'NODE_ENV',
  ['development', 'test', 'production'] as const,
  'development',
);

export const config = {
  nodeEnv,
  esProduccion: nodeEnv === 'production',
  puerto: numero('PORT', 3000),
  uploadPath: opcional('UPLOAD_PATH', 'uploads'),
  apiUrl: opcional('API_URL', 'http://localhost:3000'),
  basePath: opcional('HOST', '/'), // local: "/", servidor: "/app/dms/"

  db: {
    url: opcional('DATABASE_URL', ''),
    host: opcional('DB_HOST', 'localhost'),
    port: numero('DB_PORT', 3306),
    nombre: opcional('DBNAMES', 'restaurante'),
    usuario: opcional('DB_USER', 'root'),
    password: opcional('DB_PASSWORD', ''),
  },

  cors: {
    origenes: opcional('CORS_ORIGINS', 'http://localhost:4200')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  jwt: {
    secret: opcional('JWT_SECRET', ''),
    expiracion: opcional('JWT_EXPIRES_IN', '15m'),
    refreshSecret: opcional('JWT_REFRESH_SECRET', ''),
    refreshExpiracion: opcional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  bcrypt: {
    rounds: numero('BCRYPT_ROUNDS', 12),
  },
} as const;
