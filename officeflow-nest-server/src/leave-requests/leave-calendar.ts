import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LeavePeriod } from '@prisma/client';
import { DateTime } from 'luxon';
import type { SlaPolicyConfig } from '../sla/sla-policy';
import { parseDateOnly } from '../utils/formatDate';

export type LeaveCalendar = Pick<
  SlaPolicyConfig,
  'timezone' | 'workingDays' | 'holidays'
>;

export function leaveDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000)
    throw new BadRequestException('Invalid leave date');
  return parseDateOnly(value);
}

export function leaveWorkingDays(
  start: string,
  end: string,
  period: LeavePeriod,
  calendar: LeaveCalendar,
) {
  const startDate = leaveDate(start);
  const endDate = leaveDate(end);
  const span = (endDate.getTime() - startDate.getTime()) / 86_400_000;
  if (span < 0 || span > 365)
    throw new BadRequestException(
      'Leave must span between 1 and 366 calendar days',
    );
  if (period !== LeavePeriod.FULL_DAY && start !== end)
    throw new BadRequestException(
      'Half-day leave must start and end on the same date',
    );
  if (!calendar.workingDays.length)
    throw new UnprocessableEntityException(
      'Leave working calendar is not configured',
    );

  const holidays = new Set(calendar.holidays);
  const days: Array<{ date: Date; halfDays: number }> = [];
  for (let offset = 0; offset <= span; offset++) {
    const date = new Date(startDate.getTime() + offset * 86_400_000);
    const weekday = date.getUTCDay() || 7;
    if (
      calendar.workingDays.includes(weekday) &&
      !holidays.has(date.toISOString().slice(0, 10))
    )
      days.push({ date, halfDays: period === LeavePeriod.FULL_DAY ? 2 : 1 });
  }
  if (!days.length)
    throw new BadRequestException('Leave contains no working days');
  return days;
}

export function leaveToday(timezone: string, now = new Date()) {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate()!;
}

export function leaveMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month))
    throw new BadRequestException('Invalid calendar month');
  const start = leaveDate(`${month}-01`);
  const next = DateTime.fromJSDate(start, { zone: 'UTC' }).plus({ months: 1 });
  if (!next.isValid || next.year > 9999)
    throw new BadRequestException('Invalid calendar month');
  return { start, end: next.minus({ days: 1 }).toJSDate() };
}
