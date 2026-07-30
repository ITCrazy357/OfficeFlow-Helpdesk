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
import { DEFAULT_SEED_PASSWORD, seedUsers } from './users.seed';

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  return databaseUrl;
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(getDatabaseUrl()),
});

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);

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
}

void main()
  .catch((error: unknown) => {
    console.error('OfficeFlow seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
