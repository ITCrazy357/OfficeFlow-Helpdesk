export type UserRole = "ADMIN" | "MANAGER" | "IT_STAFF" | "EMPLOYEE";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  departmentId?: number | null;
  createdAt?: string;
  department?: {
    id: number;
    name: string;
  } | null;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  departmentId?: number;
};
