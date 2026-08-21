export type UserRole = "ADMIN" | "MANAGER" | "IT_STAFF" | "EMPLOYEE";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  isLocked?: boolean;
  mustChangePassword: boolean;
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

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  passwordChanged: true;
  mustChangePassword: false;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ForgotPasswordResponse = {
  accepted: true;
};

export type ResetForgottenPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetForgottenPasswordResponse = {
  passwordReset: true;
};
