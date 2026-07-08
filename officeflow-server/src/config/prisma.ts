import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const sslAccept = parsedDatabaseUrl.searchParams.get("sslaccept");
const sslCert = parsedDatabaseUrl.searchParams.get("sslcert");

const ssl =
  sslAccept || sslCert
    ? {
        rejectUnauthorized: sslAccept === "strict",
        ...(sslCert
          ? { ca: readFileSync(resolve(process.cwd(), sslCert), "utf8") }
          : {}),
      }
    : undefined;

const adapter = new PrismaMariaDb({
  host: parsedDatabaseUrl.hostname,
  port: Number(parsedDatabaseUrl.port || 3306),
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: decodeURIComponent(parsedDatabaseUrl.password),
  database: parsedDatabaseUrl.pathname.replace(/^\//, ""),
  ssl,
});

export const prisma = new PrismaClient({ adapter });
