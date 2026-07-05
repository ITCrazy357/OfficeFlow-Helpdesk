import { UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma";

async function main() {
  // Seed departments
  const departments = ["IT", "HR", "Finance", "Marketing"];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed an admin user in the IT department
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

  // Seed an employee user in the HR department
  const hrDepartment = await prisma.department.findUnique({
    where: { name: "HR" },
  });

  if (!hrDepartment) {
    throw new Error("HR department not found");
  }

  await prisma.user.upsert({
    where: { email: "employee1@officeflow.com" },
    update: {},
    create: {
      name: "Employee One",
      email: "employee1@officeflow.com",
      passwordHash,
      role: UserRole.EMPLOYEE,
      departmentId: hrDepartment.id,
    },
  });

  const categoryNames = ["Hardware", "Software", "Network", "Account", "Other"];

  for (const name of categoryNames) {
    await prisma.ticketCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

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
