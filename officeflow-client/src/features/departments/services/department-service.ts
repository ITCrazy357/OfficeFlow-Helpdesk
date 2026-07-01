import { apiRequest } from "@/shared/api/http-client";
import type { Department } from "@/features/departments/types";

export const departmentService = {
  list() {
    return apiRequest<Department[]>("/departments");
  },
};

