FROM node:lts-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

RUN npm run build

RUN mkdir -p uploads logs

EXPOSE 3000

RUN chown -R node:node /usr/src/app
USER node

CMD ["node", "dist/server.js"]