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
const sslAccept = parsedDatabaseUrl.searchParams.get("sslaccept")?.toLowerCase();
const sslCert = parsedDatabaseUrl.searchParams.get("sslcert");
const sslMode = (parsedDatabaseUrl.searchParams.get("ssl-mode") ??
    parsedDatabaseUrl.searchParams.get("sslmode"))?.toLowerCase();
const sslCertPath = sslCert ? (0, node_path_1.resolve)(process.cwd(), sslCert) : undefined;
const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 30000);
const acquireTimeout = Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 30000);
if (sslCertPath && !(0, node_fs_1.existsSync)(sslCertPath)) {
    console.warn(`DATABASE_URL sslcert file was not found: ${sslCertPath}`);
}
const ssl = sslAccept || sslMode || sslCert
    ? {
        rejectUnauthorized: sslAccept !== "accept_invalid_certs" &&
            sslAccept !== "accept_invalid_hostnames" &&
            sslMode !== "required",
        ...(sslCertPath && (0, node_fs_1.existsSync)(sslCertPath)
            ? { ca: (0, node_fs_1.readFileSync)(sslCertPath, "utf8") }
            : {}),
    }
    : undefined;
const adapter = new adapter_mariadb_1.PrismaMariaDb({
    host: parsedDatabaseUrl.hostname,
    port: Number(parsedDatabaseUrl.port || 3306),
    user: decodeURIComponent(parsedDatabaseUrl.username),
    password: decodeURIComponent(parsedDatabaseUrl.password),
    database: parsedDatabaseUrl.pathname.replace(/^\//, ""),
    connectTimeout,
    acquireTimeout,
    ssl,
});
exports.prisma = new client_1.PrismaClient({ adapter });
