import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const sslAccept = parsedDatabaseUrl.searchParams.get("sslaccept")?.toLowerCase();
const sslMode = (
  parsedDatabaseUrl.searchParams.get("ssl-mode") ??
  parsedDatabaseUrl.searchParams.get("sslmode")
)?.toLowerCase();

const ssl =
  sslAccept || sslMode
    ? {
        rejectUnauthorized:
          sslAccept !== "accept_invalid_certs" &&
          sslAccept !== "accept_invalid_hostnames" &&
          sslMode !== "required",
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
