export type HealthStatus = {
  status: "ok" | string;
};

export type DbHealthDepartment = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};
