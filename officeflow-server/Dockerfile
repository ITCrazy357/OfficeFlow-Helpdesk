FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "dev"]