FROM node:lts-alpine

# Variables de entorno
ENV NODE_ENV=production

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (necesarias para compilar TypeScript)
RUN npm ci --include=dev

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Eliminar devDependencies después de compilar
RUN npm prune --production --no-audit

# Crear directorios necesarios
RUN mkdir -p uploads logs

# Exponer puerto
EXPOSE 3000

# Cambiar permisos
RUN chown -R node:node /usr/src/app
USER node

# Iniciar aplicación
CMD ["node", "dist/app.js"]