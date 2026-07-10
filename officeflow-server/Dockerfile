FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json ./
COPY src ./src
COPY certs ./certs

RUN npm run build
RUN npm prune --omit=dev

EXPOSE 5000

CMD ["npm", "start"]
