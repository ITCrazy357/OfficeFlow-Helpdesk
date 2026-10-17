import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getMigrationDatabaseUrl } from './src/prisma/database.config';

export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
    seed: 'ts-node src/prisma/seed/index.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL
      ? getMigrationDatabaseUrl(
          process.env.DATABASE_URL,
          process.env.DATABASE_SSL_CA_PATH,
        )
      : undefined,
  },
});
