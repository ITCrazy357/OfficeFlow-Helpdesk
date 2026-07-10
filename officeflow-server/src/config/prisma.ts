import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const sslAccept = parsedDatabaseUrl.searchParams.get("sslaccept")?.toLowerCase();
const sslCert = parsedDatabaseUrl.searchParams.get("sslcert");
const sslMode = (
  parsedDatabaseUrl.searchParams.get("ssl-mode") ??
  parsedDatabaseUrl.searchParams.get("sslmode")
)?.toLowerCase();
const sslCertPath = sslCert ? resolve(process.cwd(), sslCert) : undefined;
const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 30000);
const acquireTimeout = Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 30000);

if (sslCertPath && !existsSync(sslCertPath)) {
  console.warn(`DATABASE_URL sslcert file was not found: ${sslCertPath}`);
}

const ssl =
  sslAccept || sslMode || sslCert
    ? {
        rejectUnauthorized:
          sslAccept !== "accept_invalid_certs" &&
          sslAccept !== "accept_invalid_hostnames" &&
          sslMode !== "required",
        ...(sslCertPath && existsSync(sslCertPath)
          ? { ca: readFileSync(sslCertPath, "utf8") }
          : {}),
      }
    : undefined;

const adapter = new PrismaMariaDb({
  host: parsedDatabaseUrl.hostname,
  port: Number(parsedDatabaseUrl.port || 3306),
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: decodeURIComponent(parsedDatabaseUrl.password),
  database: parsedDatabaseUrl.pathname.replace(/^\//, ""),
  connectTimeout,
  acquireTimeout,
  ssl,
});

export const prisma = new PrismaClient({ adapter });
