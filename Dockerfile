FROM node:lts-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --include=dev

RUN npx prisma generate

COPY . .

RUN npm run build

RUN npm prune --production --no-audit

RUN mkdir -p uploads logs

EXPOSE 3000

RUN chown -R node:node /usr/src/app
USER node

CMD ["node", "dist/app.js"]