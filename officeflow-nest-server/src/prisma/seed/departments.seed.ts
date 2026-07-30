import type { Department, PrismaClient } from '@prisma/client';
import { createRecordMap } from './seed.utils';

const departmentNames = [
  'IT',
  'HR',
  'Finance',
  'Marketing',
  'Operations',
] as const;

export async function seedDepartments(prisma: PrismaClient) {
  const departments: Array<[string, Department]> = [];

  for (const name of departmentNames) {
    const department = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    departments.push([name, department]);
  }

  return createRecordMap(departments);
}
