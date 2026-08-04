import type { UserRole } from "@/features/auth/types";

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  departmentId: number | null;
  createdAt: string;
  department?: {
    id: number;
    name: string;
  } | null;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  departmentId: number;
};

export type UpdateUserInput = {
  name: string;
  email: string;
  role: UserRole;
  departmentId: number;
};

export type ChangeUserStatusInput = {
  isActive: boolean;
};

export type ResetUserPasswordInput = {
  password: string;
};
