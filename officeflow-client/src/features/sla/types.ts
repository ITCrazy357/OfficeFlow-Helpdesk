import type { TicketPriority } from "@/features/tickets/types";

export type SlaPolicyConfig = {
  mode: "CALENDAR" | "BUSINESS";
  timezone: string;
  workingDays: number[];
  workingHours: Array<{ start: string; end: string }>;
  holidays: string[];
  targets: Record<
    TicketPriority,
    { responseMinutes: number | null; resolutionMinutes: number }
  >;
  warningMinutes: number;
  escalation: "NONE" | "ADMINS" | "ADMINS_AND_MANAGER";
};

export type SlaPolicy = {
  version: number;
  config: SlaPolicyConfig;
  updatedAt: string | null;
};
