export type UserRole = "ADMIN" | "MANAGER" | "IT_STAFF" | "EMPLOYEE";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  departmentId?: number | null;
  department?: {
    id: number;
    name: string;
  } | null;
  createdAt?: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

