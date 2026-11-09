import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export const WARRANTY_REMINDER_DAYS = 30;
export const ASSET_CARE_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Legacy warrantyUntil is a timestamp; scheduled/performed dates are SQL DATE.
// Keep their query boundaries separate so timestamps near midnight stay on the
// same Vietnam date shown in the asset screen and reminder.
export function warrantyWindow(now = new Date()) {
  const start = DateTime.fromJSDate(now, { zone: ASSET_CARE_TIMEZONE }).startOf(
    'day',
  );
  return {
    start: start.toJSDate(),
    end: start.plus({ days: WARRANTY_REMINDER_DAYS + 1 }).toJSDate(),
  };
}

export function warrantyCalendarDate(date: Date) {
  return DateTime.fromJSDate(date, { zone: ASSET_CARE_TIMEZONE }).toISODate()!;
}

export function assetCareDates(now = new Date()) {
  const today = DateTime.fromJSDate(now, {
    zone: ASSET_CARE_TIMEZONE,
  }).toISODate()!;
  const start = new Date(`${today}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + WARRANTY_REMINDER_DAYS + 1);
  return { today, start, end };
}

export function parseAssetCareDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '1000-01-01' ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Use a valid YYYY-MM-DD date');
  return date;
}
