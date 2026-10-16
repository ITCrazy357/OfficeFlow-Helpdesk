import { BadRequestException } from '@nestjs/common';
import { TicketPriority } from '@prisma/client';
import { DateTime, IANAZone } from 'luxon';

export type SlaTarget = {
  responseMinutes: number | null;
  resolutionMinutes: number;
};
export type SlaPolicyConfig = {
  mode: 'CALENDAR' | 'BUSINESS';
  timezone: string;
  workingDays: number[];
  workingHours: Array<{ start: string; end: string }>;
  holidays: string[];
  targets: Record<TicketPriority, SlaTarget>;
  warningMinutes: number;
  escalation: 'NONE' | 'ADMINS' | 'ADMINS_AND_MANAGER';
};

// Agreed default: Monday-Friday, 08:00-12:00 and 13:00-17:00 Vietnam time.
// Response targets, warning lead time and exact holiday dates are set by ADMIN.
export const DEFAULT_SLA_POLICY: SlaPolicyConfig = {
  mode: 'BUSINESS',
  timezone: 'Asia/Ho_Chi_Minh',
  workingDays: [1, 2, 3, 4, 5],
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  holidays: [],
  targets: {
    URGENT: { responseMinutes: null, resolutionMinutes: 240 },
    HIGH: { responseMinutes: null, resolutionMinutes: 480 },
    MEDIUM: { responseMinutes: null, resolutionMinutes: 1440 },
    LOW: { responseMinutes: null, resolutionMinutes: 3360 },
  },
  warningMinutes: 0,
  escalation: 'ADMINS_AND_MANAGER',
};

export function parseClock(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== '24:00') {
    throw new BadRequestException('Working hours must use HH:mm');
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateSlaPolicy(policy: SlaPolicyConfig): SlaPolicyConfig {
  if (!IANAZone.isValidZone(policy.timezone))
    throw new BadRequestException('Invalid SLA timezone');
  if (
    policy.mode === 'BUSINESS' &&
    (!policy.workingDays.length || !policy.workingHours.length)
  ) {
    throw new BadRequestException(
      'Business SLA requires working days and hours',
    );
  }
  let previousEnd = -1;
  for (const interval of policy.workingHours) {
    const start = parseClock(interval.start);
    const end = parseClock(interval.end);
    if (start < previousEnd || end - start < 15) {
      throw new BadRequestException(
        'Working intervals must be ordered, not overlap and last at least 15 minutes',
      );
    }
    previousEnd = end;
  }
  for (const date of policy.holidays) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid) {
      throw new BadRequestException(
        'Holidays must contain valid YYYY-MM-DD dates',
      );
    }
  }
  for (const target of Object.values(policy.targets)) {
    if (
      target.responseMinutes !== null &&
      target.responseMinutes > target.resolutionMinutes
    ) {
      throw new BadRequestException(
        'First response deadline must not exceed resolution deadline',
      );
    }
  }
  return policy;
}
