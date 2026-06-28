"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const client_1 = require("@prisma/client");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
}
const adapter = new adapter_mariadb_1.PrismaMariaDb(databaseUrl);
exports.prisma = new client_1.PrismaClient({ adapter });
