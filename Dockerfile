FROM node:lts-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

# 1. Dependencias primero (aprovecha cache de Docker)
COPY package*.json ./
COPY prisma ./prisma/

# 2. Instala TODO incluyendo dev (necesario para tsc, tsc-alias, prisma)
RUN npm ci --include=dev

# 3. Genera el client de Prisma (necesita estar antes del build)
RUN npx prisma generate

# 4. Copia el resto del código fuente
COPY src ./src
COPY tsconfig.json ./
# ↑ NO copies .env — las variables vienen del servidor/docker environment

# 5. Compila TypeScript Y resuelve alias @/ 
RUN npm run build
# package.json debe tener: "build": "tsc && tsc-alias"

# 6. Elimina devDependencies (tsc, tsc-alias, prisma CLI ya no se necesitan)
RUN npm prune --production --no-audit

# 7. Carpetas necesarias en runtime
RUN mkdir -p uploads logs

EXPOSE 3000

RUN chown -R node:node /usr/src/app
USER node

CMD ["node", "dist/app.js"]