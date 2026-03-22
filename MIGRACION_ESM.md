# Migración a ES Modules (ESM)

## Contexto

El proyecto usaba **CommonJS** (CJS) como sistema de módulos. Al intentar ejecutarlo en Docker con Node.js v24, el cliente Prisma generado fallaba con errores de `import.meta` y exports no reconocidos. La causa raíz era que **Prisma v7 genera código ESM nativo**, incompatible con un proyecto CJS.

Esta documentación registra todos los cambios realizados, por qué fueron necesarios y cómo se relacionan entre sí.

---

## Resumen de errores resueltos (en orden cronológico)

| # | Error | Causa | Solución |
|---|-------|-------|----------|
| 1 | `exports is not defined in ES module scope` | Prisma generaba CJS pero Node.js lo detectaba como ESM | `postbuild` con `{"type":"commonjs"}` (solución temporal, reemplazada) |
| 2 | `Cannot use 'import.meta' outside a module` | Prisma v7 en Linux genera `import.meta.url`; TypeScript no lo transforma en CJS | Migración a ESM (solución definitiva) |
| 3 | `Cannot find module '.../internal/class.ts'` | Prisma generaba imports con extensión `.ts`; Node.js ESM los busca literalmente | `importFileExtension = "js"` en `schema.prisma` |
| 4 | `'jsonwebtoken' does not provide an export named 'JsonWebTokenError'` | `jsonwebtoken` es CJS puro; Node.js ESM no puede importar sus exports con nombre | Cambio a import por defecto (`import jwt from 'jsonwebtoken'`) |
| 5 | `Container exited with code 0` | `CMD` apuntaba a `dist/app.js` (solo exporta el objeto Express) en vez del entry point real | `CMD ["node", "dist/server.js"]` |

---

## Archivos modificados

### `tsconfig.json` — El cambio más importante

**Antes:**
```json
{
  "module": "commonjs",
  "moduleResolution": "node"
}
```

**Después:**
```json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

#### ¿Por qué fue necesario este cambio?

TypeScript usa `"module"` para decidir **qué formato de código emite** al compilar:

- `"commonjs"` → emite `require()` / `module.exports` (CJS)
- `"NodeNext"` → emite `import` / `export` (ESM nativo)

**El problema fundamental**: Prisma v7 con el generador `prisma-client` genera TypeScript que contiene `import.meta.url`. Esta es sintaxis **exclusiva de ESM**:

```ts
// Esto genera Prisma v7 en Linux:
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))
```

TypeScript **no puede transformar `import.meta`** al compilar a CJS porque no existe equivalente en CommonJS. Los archivos generados tienen `// @ts-nocheck`, por lo que el error de TypeScript se suprime pero el código pasa tal cual al output — y Node.js lo rechaza al ejecutarlo.

Con `"module": "NodeNext"`, TypeScript emite ESM válido donde `import.meta.url` funciona correctamente.

#### ¿Qué implica `"moduleResolution": "NodeNext"`?

Define cómo TypeScript **resuelve los imports** durante la compilación:

- `"node"` (viejo): resuelve `from './foo'` buscando `foo.ts`, `foo/index.ts`, etc. Permisivo con las extensiones.
- `"NodeNext"`: sigue las reglas de Node.js ESM, que requieren **extensiones explícitas** en los imports.

Por eso todos los imports locales en `src/` tuvieron que actualizarse de:
```ts
import { config } from '@/config/servidor.config'
```
a:
```ts
import { config } from '@/config/servidor.config.js'
```

TypeScript con NodeNext resuelve `'./config/servidor.config.js'` → busca `./config/servidor.config.ts` en compilación, y emite `'./config/servidor.config.js'` en el output para que Node.js ESM lo encuentre en `dist/`.

---

### `package.json`

| Campo | Antes | Después | Razón |
|-------|-------|---------|-------|
| `"type"` | *(ausente)* | `"module"` | Le dice a Node.js que todos los `.js` del proyecto son ES Modules |
| `"build"` | `"tsc && tsc-alias"` | *(sin cambio)* | — |
| `"postbuild"` | `node -e "...writeFile('dist/generated/prisma/package.json', ...)"` | *(eliminado)* | Era un workaround CJS. Con ESM ya no se necesita |
| `"start"` | `"node dist/app.js"` | `"node dist/server.js"` | `app.js` solo exporta el objeto Express; `server.js` llama a `listen()` |
| `"dev"` | `"tsx -r tsconfig-paths/register src/server.ts"` | `"tsx src/server.ts"` | `tsx` v4 resuelve los path aliases del tsconfig nativamente en ESM |

---

### `prisma/schema.prisma`

**Antes:**
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

**Después:**
```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  importFileExtension = "js"
}
```

**Razón**: Prisma v7 en Linux genera imports **con extensión `.ts`** (ej: `from "./internal/class.ts"`). TypeScript con `// @ts-nocheck` no los reescribe a `.js` al compilar, así que el output tiene `from "./internal/class.ts"`. Node.js ESM busca ese archivo literalmente y no lo encuentra (en `dist/` existe `class.js`, no `class.ts`).

Con `importFileExtension = "js"`, Prisma genera `from "./internal/class.js"` en todas las plataformas. TypeScript lo emite tal cual, y Node.js ESM lo resuelve correctamente.

---

### `dockerfile`

```dockerfile
# Antes
CMD ["node", "dist/app.js"]

# Después
CMD ["node", "dist/server.js"]
```

**Razón**: `dist/app.js` (compilado de `src/app.ts`) solo configura y exporta el objeto Express. No llama a `app.listen()`, por lo que el proceso carga el módulo, no encuentra nada que mantenga el event loop vivo, y termina con código 0 (salida limpia sin error).

`dist/server.js` es el entry point real: importa el app, llama a `listen()`, y registra los handlers de SIGTERM/SIGINT que mantienen el proceso activo.

---

### `src/middlewares/error.middlewares.ts`

**Antes:**
```ts
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
```

**Después:**
```ts
import jwt from 'jsonwebtoken';
// Uso: jwt.JsonWebTokenError, jwt.TokenExpiredError
```

**Razón**: `jsonwebtoken` es un paquete **CJS puro** (no tiene exports ESM). Cuando Node.js ESM carga un módulo CJS, solo expone un **default export** con todo el `module.exports`. Los named imports (`{ X }`) funcionan solo si Node.js puede analizar estáticamente el `module.exports` del paquete, lo cual no siempre es posible.

La solución estándar para módulos CJS en ESM: importar el default y acceder a las clases como propiedades (`jwt.JsonWebTokenError`, `jwt.TokenExpiredError`).

---

### Todos los archivos en `src/` — Extensiones en imports

Con `"moduleResolution": "NodeNext"`, todos los imports relativos y de alias necesitan extensión `.js` explícita.

**Archivos modificados:**
- `src/server.ts`
- `src/app.ts`
- `src/config/database.config.ts`
- `src/middlewares/error.middlewares.ts`
- `src/middlewares/validar.middleware.ts` *(sin imports locales — no necesitó cambios)*
- `src/routes/index.ts`
- `src/routes/ct_tipo_documentos.route.ts`
- `src/routes/dt_documento.route.ts`
- `src/controllers/ct_tipo_documento.controller.ts`
- `src/controllers/dt_documento.controller.ts`
- `src/services/ct_tipo_documento.service.ts`
- `src/services/dt_documento.service.ts`
- `src/utils/errores.utils.ts`
- `src/utils/prisma.utils.ts`
- `src/utils/paginacion.utils.ts`
- `src/utils/logger.utils.ts`
- `src/utils/archivo.utils.ts`
- `src/types/index.ts`

**Patrón aplicado:**
```ts
// Antes
import { config } from '@/config/servidor.config'
import { router } from '@/routes'

// Después
import { config } from '@/config/servidor.config.js'
import { router } from '@/routes/index.js'  // index debe ser explícito en NodeNext
```

---

### `src/services/dt_documento.service.ts` — Tipos explícitos en `buscarOError`

```ts
// Antes
const tipodoc = await buscarOError(prisma.ct_tipo_documento.findFirst({...}), 'ct_tipo_documento')

// Después
const tipodoc = await buscarOError<ct_tipo_documento>(prisma.ct_tipo_documento.findFirst({...}), 'ct_tipo_documento')
```

**Razón**: Con `"moduleResolution": "NodeNext"`, TypeScript es más estricto con la inferencia de tipos genéricos en funciones que reciben `Promise<T | null>`. Sin el tipo explícito, TypeScript infería `T = unknown`. Afectaba solo a `dt_documento.service.ts` y su controlador.

---

## Diagrama de la arquitectura de módulos

```
src/server.ts          →  dist/server.js   ← node dist/server.js (entry point)
  └─ src/app.ts        →  dist/app.js      (solo configura Express, no llama listen)
       └─ src/routes/  →  dist/routes/
            └─ src/controllers/ → dist/controllers/
                 └─ src/services/ → dist/services/
                      └─ src/generated/prisma/ → dist/generated/prisma/
                           └─ imports con .js (gracias a importFileExtension = "js")
```

---

## Nota para el CI/CD (`.gitlab-ci.yml`)

El pipeline de GitLab no requirió cambios de fondo porque:
- Ya usaba `npm run build` (incluye `tsc && tsc-alias`)
- Los cambios en `tsconfig.json` afectan la compilación pero no el comando que la dispara
- El servidor de destino usa Node.js compatible con ESM

Lo único que cambió implícitamente: el servidor ahora debe ejecutar `node dist/server.js` en lugar de `node dist/app.js` si el inicio se hace manualmente.
