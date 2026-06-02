# Document Management System (DMS) API

## Descripción
Este proyecto es un Sistema de Gestión de Documentos (Document Management System - DMS) desarrollado como una API robusta y escalable. Su función principal es recibir documentos y validarlos estrictamente de acuerdo a un catálogo configurado antes de su almacenamiento.

## Características Principales

- **Recepción de Documentos**: Endpoints optimizados para la carga y gestión de archivos.
- **Validación por Catálogo**:
  - **Tipo de Documento**: Verifica que la extensión y el MIME type del documento subido correspondan a los formatos permitidos.
  - **Capacidad Máxima**: Controla el tamaño del archivo para asegurar que no exceda los límites definidos en el catálogo.
- **Prevención de Duplicados (Hashing)**: Al momento de procesar un archivo, el sistema genera y verifica un hash único basado en el contenido y el tipo de documento. Esto garantiza que un mismo archivo no se suba dos veces al sistema.
- **Almacenamiento Flexible (Multi-Storage)**:
  - **Local/Servidor**: Permite guardar el documento en el servidor, registrando sus referencias, metadatos y relaciones creando los registros correspondientes en las tablas de la base de datos.
  - **Amazon S3**: Soporte nativo para delegar el almacenamiento de los archivos a buckets de AWS S3 de forma segura.
- **Buenas Prácticas de Código**:
  - **ESLint**: Configurado para forzar reglas estrictas de código y prevenir errores comunes.
  - **Prettier**: Implementado para asegurar un formateo de código consistente en todo el equipo.

## Tecnologías y Stack

- **Entorno**: Node.js, Express, TypeScript
- **Base de Datos & ORM**: MariaDB, Prisma ORM
- **Almacenamiento en Nube**: AWS SDK (S3)
- **Validaciones**: Zod (para validación de esquemas y payloads)
- **Gestión de Archivos**: Multer
- **Herramientas de Calidad**: ESLint, Prettier, Vitest (Testing)
- **Contenedores**: Docker, Docker Compose

## Requisitos Previos

- **Node.js** (v20 o superior recomendado)
- **pnpm** (Gestor de paquetes utilizado en el proyecto)
- **MariaDB** (o Docker para levantar la base de datos)
- (Opcional) Credenciales de AWS S3 si se utiliza el proveedor en la nube.

## Instalación y Configuración

1. **Clonar el repositorio** e instalar las dependencias:
   ```bash
   pnpm install
   ```

2. **Configurar las variables de entorno**:
   Copia el archivo de ejemplo para crear tu configuración local y ajusta los valores de conexión a la base de datos, credenciales S3, puertos, etc.
   ```bash
   cp .env.example .env
   ```

## Base de Datos (Prisma)

El proyecto utiliza Prisma ORM. Antes de levantar el proyecto, asegúrate de inicializar la base de datos y correr las migraciones:

```bash
# Generar el cliente de Prisma
pnpm db:generate

# Ejecutar las migraciones en desarrollo
pnpm db:migrate

# (Opcional) Poblar la base de datos con datos iniciales (Seed)
pnpm db:seed
```

## Scripts Disponibles

El proyecto incluye múltiples scripts para facilitar el desarrollo:

- `pnpm dev`: Inicia el servidor en modo desarrollo con recarga automática (Nodemon + TSX).
- `pnpm build`: Compila el código TypeScript a JavaScript en el directorio `dist`.
- `pnpm start`: Inicia el servidor en producción utilizando el código compilado.
- `pnpm lint`: Analiza el código con ESLint en busca de problemas.
- `pnpm lint:fix`: Corrige automáticamente problemas menores reportados por ESLint.
- `pnpm format`: Formatea todo el código usando Prettier.
- `pnpm test`: Ejecuta la suite de pruebas automatizadas con Vitest.
- `pnpm test:coverage`: Genera un reporte de cobertura de pruebas.

## Despliegue con Docker

Para facilitar el despliegue de la API y sus dependencias (como la base de datos), el proyecto incluye configuración de Docker Compose:

```bash
# Construir y levantar los contenedores en segundo plano
docker-compose up -d --build
```

Esto levantará los servicios definidos, exponiendo la API y la base de datos en los puertos configurados.
