FROM node:22-alpine

# Pin the package manager used to install the application.
RUN npm install --global npm@12.2.0

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# npm 12.2.0 still bundles vulnerable versions of these libraries.
# Install compatible fixes separately so application dependencies stay locked.
RUN npm install --prefix /tmp/npm-security-patches --ignore-scripts --no-audit --no-fund \
      brace-expansion@5.0.11 http-cache-semantics@4.3.0 undici@6.28.1 \
    && cp -R /tmp/npm-security-patches/node_modules/. /usr/local/lib/node_modules/npm/node_modules/ \
    && rm -rf /tmp/npm-security-patches

EXPOSE 5001

CMD ["npm", "run", "start:deploy"]
