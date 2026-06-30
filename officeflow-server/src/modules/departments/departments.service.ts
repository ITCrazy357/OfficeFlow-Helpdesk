import { prisma } from "../../config/prisma";

export async function getDepartmentsService() {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return departments;
}
