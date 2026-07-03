import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { RegisterInput, LoginInput } from "./auth.schema";
import { signAccessToken } from "../../utils/jwt";
import { AppError } from "../../utils/AppError";

export async function registerService(input: RegisterInput) {
  const existedUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existedUser) {
    throw new AppError("Email already exists", 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      departmentId: input.departmentId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      departmentId: true,
      createdAt: true,
    },
  });

  return user;
}

//
export async function loginService(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 400);
  }

  if (user.isActive === false) {
    throw new AppError("Account is inactive", 400);
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatch) {
    throw new AppError("Invalid email or password", 400);
  }

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
  });

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    departmentId: user.departmentId,
    createdAt: user.createdAt,
  };

  return { accessToken, user: safeUser };
}

export async function getMeService(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}
