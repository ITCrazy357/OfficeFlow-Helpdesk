import {
  UserRole,
  type Department,
  type PrismaClient,
  type User,
} from '@prisma/client';
import { createRecordMap } from './seed.utils';

export const DEFAULT_SEED_PASSWORD = 'OfficeFlow@123';

const userSeeds = [
  {
    key: 'admin',
    name: 'Nguyễn Minh Admin',
    email: 'admin@officeflow.com',
    role: UserRole.ADMIN,
    department: 'IT',
  },
  {
    key: 'manager-it',
    name: 'Trần Quốc Anh',
    email: 'manager.it@officeflow.com',
    role: UserRole.MANAGER,
    department: 'IT',
  },
  {
    key: 'manager-operations',
    name: 'Lê Thu Trang',
    email: 'manager.operations@officeflow.com',
    role: UserRole.MANAGER,
    department: 'Operations',
  },
  {
    key: 'it-linh',
    name: 'Phạm Hoàng Linh',
    email: 'it.linh@officeflow.com',
    role: UserRole.IT_STAFF,
    department: 'IT',
  },
  {
    key: 'it-minh',
    name: 'Võ Tuấn Minh',
    email: 'it.minh@officeflow.com',
    role: UserRole.IT_STAFF,
    department: 'IT',
  },
  {
    key: 'it-ha',
    name: 'Đặng Ngọc Hà',
    email: 'it.ha@officeflow.com',
    role: UserRole.IT_STAFF,
    department: 'IT',
  },
  {
    key: 'it-quang',
    name: 'Bùi Hải Quang',
    email: 'it.quang@officeflow.com',
    role: UserRole.IT_STAFF,
    department: 'IT',
  },
  {
    key: 'employee-binh',
    name: 'Nguyễn Văn Bình',
    email: 'employee.binh@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Operations',
  },
  {
    key: 'employee-lan',
    name: 'Trần Mỹ Lan',
    email: 'employee.lan@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'HR',
  },
  {
    key: 'employee-hung',
    name: 'Lê Quốc Hùng',
    email: 'employee.hung@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Finance',
  },
  {
    key: 'employee-thao',
    name: 'Phạm Thanh Thảo',
    email: 'employee.thao@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Marketing',
  },
  {
    key: 'employee-nam',
    name: 'Đỗ Hoài Nam',
    email: 'employee.nam@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Operations',
  },
  {
    key: 'employee-mai',
    name: 'Hoàng Ngọc Mai',
    email: 'employee.mai@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'HR',
  },
  {
    key: 'employee-phuong',
    name: 'Vũ Khánh Phương',
    email: 'employee.phuong@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Finance',
  },
  {
    key: 'employee-duc',
    name: 'Phan Minh Đức',
    email: 'employee.duc@officeflow.com',
    role: UserRole.EMPLOYEE,
    department: 'Marketing',
  },
] as const;

export async function seedUsers(
  prisma: PrismaClient,
  departments: Record<string, Department>,
  passwordHash: string,
) {
  const users: Array<[string, User]> = [];

  for (const seed of userSeeds) {
    const data = {
      name: seed.name,
      passwordHash,
      role: seed.role,
      isActive: true,
      departmentId: departments[seed.department].id,
    };
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: data,
      create: {
        email: seed.email,
        ...data,
      },
    });

    users.push([seed.key, user]);
  }

  return createRecordMap(users);
}
