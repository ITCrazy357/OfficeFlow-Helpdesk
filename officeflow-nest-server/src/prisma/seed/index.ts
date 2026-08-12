import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { seedAssets } from './assets.seed';
import { seedAuditLogs } from './audit-logs.seed';
import { seedCategories } from './categories.seed';
import { seedDepartments } from './departments.seed';
import { seedKnowledgeBase } from './knowledge-base.seed';
import { seedNotifications } from './notifications.seed';
import { seedTickets } from './tickets.seed';
import { seedUsers } from './users.seed';

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  return databaseUrl;
}

function getSeedPassword() {
  const password = process.env.SEED_DEFAULT_PASSWORD;

  if (!password || password.length < 12 || password.startsWith('replace-')) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD must contain at least 12 non-placeholder characters',
    );
  }

  return password;
}

function assertSeedTargetAllowed(databaseUrl: string) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_SEED !== '1'
  ) {
    throw new Error(
      'Production seed is disabled; set ALLOW_PRODUCTION_SEED=1 only after verifying the target database',
    );
  }

  const hostname = new URL(databaseUrl).hostname.toLowerCase();
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    'mysql',
    'host.docker.internal',
  ]);

  if (!localHosts.has(hostname) && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error(
      `Remote seed target ${hostname} is disabled; set ALLOW_REMOTE_SEED=1 only after verifying the target database`,
    );
  }
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  assertSeedTargetAllowed(databaseUrl);

  const seedPassword = getSeedPassword();
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
  });
  const now = new Date();

  try {
    const passwordHash = await bcrypt.hash(seedPassword, 10);

    console.log('Seeding OfficeFlow Helpdesk...');

    const departments = await seedDepartments(prisma);
    const users = await seedUsers(prisma, departments, passwordHash);
    const categories = await seedCategories(prisma);
    const assets = await seedAssets(prisma, users, now);
    const articles = await seedKnowledgeBase(prisma, users, now);
    const tickets = await seedTickets(prisma, users, categories, assets, now);
    const notificationCount = await seedNotifications(
      prisma,
      users,
      assets,
      tickets,
      articles,
      now,
    );
    const auditLogCount = await seedAuditLogs(
      prisma,
      departments,
      users,
      tickets,
      assets,
      articles,
      now,
    );

    console.log(
      [
        `Departments: ${Object.keys(departments).length}`,
        `Users: ${Object.keys(users).length}`,
        `Categories: ${Object.keys(categories).length}`,
        `Assets: ${Object.keys(assets).length}`,
        `Knowledge articles: ${Object.keys(articles).length}`,
        `Tickets: ${tickets.length}`,
        `Notifications: ${notificationCount}`,
        `Audit logs: ${auditLogCount}`,
      ].join('\n'),
    );
    console.log('OfficeFlow seed completed.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('OfficeFlow seed failed:', error);
  process.exitCode = 1;
});
