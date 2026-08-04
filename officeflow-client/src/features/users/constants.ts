import type { UserRole } from "@/features/auth/types";

export const userRoleOptions: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "EMPLOYEE", label: "Employee" },
];

export const userRoleLabels = Object.fromEntries(
  userRoleOptions.map((option) => [option.value, option.label]),
) as Record<UserRole, string>;
