import type { UserRole } from "@/features/auth/types";

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  lockedById: number | null;
  unlockedAt: string | null;
  unlockedById: number | null;
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

export type ChangeAccountLockInput = {
  isLocked: boolean;
};

export type ChangeUserStatusInput = {
  isActive: boolean;
};

export type HandoffUserInput = { replacementId: number };

export type HandoffUserResult = {
  userId: number;
  replacementId: number;
  reportsTransferred: number;
  approvalsTransferred: number;
};

export type ResetUserPasswordInput = {
  password: string;
};
