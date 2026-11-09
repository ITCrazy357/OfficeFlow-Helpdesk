import type { UserListItem } from "@/features/users/types";
export type UserPanel =
  | { type: "create" }
  | { type: "edit"; user: UserListItem }
  | { type: "reset"; user: UserListItem }
  | { type: "activation"; user: UserListItem }
  | { type: "lock"; user: UserListItem }
  | { type: "handoff"; user: UserListItem }
  | null;
