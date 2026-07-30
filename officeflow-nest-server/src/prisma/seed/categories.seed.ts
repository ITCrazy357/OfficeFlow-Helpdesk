import type { PrismaClient, TicketCategory } from '@prisma/client';
import { createRecordMap } from './seed.utils';

const categoryNames = [
  'Hardware',
  'Software',
  'Network',
  'Email',
  'Account',
  'Printer',
  'Access Request',
  'Security',
  'Other',
] as const;

export async function seedCategories(prisma: PrismaClient) {
  const categories: Array<[string, TicketCategory]> = [];

  for (const name of categoryNames) {
    const category = await prisma.ticketCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    categories.push([name, category]);
  }

  return createRecordMap(categories);
}
