import { apiRequest } from "@/shared/api/http-client";
import type { User } from "@/features/users/types";

export const userService = {
  list() {
    return apiRequest<User[]>("/users");
  },
};

