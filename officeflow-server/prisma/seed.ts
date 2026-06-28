import { UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma";

async function main() {
  const departments = ["IT", "HR", "Finance", "Marketing"];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const itDepartment = await prisma.department.findUnique({
    where: { name: "IT" },
  });

  if (!itDepartment) {
    throw new Error("IT department not found");
  }

  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@officeflow.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@officeflow.com",
      passwordHash,
      role: UserRole.ADMIN,
      departmentId: itDepartment.id,
    },
  });

  console.log("Seed data created successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
