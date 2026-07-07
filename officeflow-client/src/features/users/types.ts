import type { UserRole } from "@/features/auth/types";

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  department?: {
    id: number;
    name: string;
  } | null;
};
