"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
}
const parsedDatabaseUrl = new URL(databaseUrl);
const sslAccept = parsedDatabaseUrl.searchParams.get("sslaccept");
const sslCert = parsedDatabaseUrl.searchParams.get("sslcert");
const ssl = sslAccept || sslCert
    ? {
        rejectUnauthorized: sslAccept === "strict",
        ...(sslCert
            ? { ca: (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(process.cwd(), sslCert), "utf8") }
            : {}),
    }
    : undefined;
const adapter = new adapter_mariadb_1.PrismaMariaDb({
    host: parsedDatabaseUrl.hostname,
    port: Number(parsedDatabaseUrl.port || 3306),
    user: decodeURIComponent(parsedDatabaseUrl.username),
    password: decodeURIComponent(parsedDatabaseUrl.password),
    database: parsedDatabaseUrl.pathname.replace(/^\//, ""),
    ssl,
});
exports.prisma = new client_1.PrismaClient({ adapter });
