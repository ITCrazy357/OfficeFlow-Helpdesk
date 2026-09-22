FROM node:22-alpine

# The Node image bundles an older npm with vulnerable transitive dependencies.
RUN npm install --global npm@11.19.1

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 5001

CMD ["npm", "run", "start:deploy"]
