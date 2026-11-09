import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { parseClock, type SlaPolicyConfig } from './sla-policy';

function atMinute(day: DateTime, minute: number) {
  return minute === 1440
    ? day.plus({ days: 1 }).startOf('day')
    : day.set({
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        second: 0,
        millisecond: 0,
      });
}

/** Elapsed SLA time, including partial minutes, using the ticket's saved calendar. */
export function elapsedSlaMinutes(
  start: Date,
  end: Date,
  policy: SlaPolicyConfig | null,
): number {
  if (end <= start) return 0;
  // Tickets created before SLA snapshots were introduced retain the 24/7 clock.
  if (!policy || policy.mode === 'CALENDAR')
    return (end.getTime() - start.getTime()) / 60_000;

  const holidays = new Set(policy.holidays);
  const intervals = policy.workingHours.map(({ start, end }) => ({
    start: parseClock(start),
    end: parseClock(end),
  }));
  let day = DateTime.fromJSDate(start, { zone: policy.timezone }).startOf(
    'day',
  );
  const lastDay = DateTime.fromJSDate(end, { zone: policy.timezone }).startOf(
    'day',
  );
  let minutes = 0;
  while (day <= lastDay) {
    if (
      policy.workingDays.includes(day.weekday) &&
      !holidays.has(day.toISODate()!)
    ) {
      for (const interval of intervals) {
        const open = Math.max(
          start.getTime(),
          atMinute(day, interval.start).toMillis(),
        );
        const close = Math.min(
          end.getTime(),
          atMinute(day, interval.end).toMillis(),
        );
        minutes += Math.max(0, close - open) / 60_000;
      }
    }
    day = day.plus({ days: 1 });
  }
  return minutes;
}

export function addSlaMinutes(
  start: Date,
  minutes: number,
  policy: SlaPolicyConfig,
): Date {
  if (!minutes) return new Date(start);
  if (policy.mode === 'CALENDAR')
    return new Date(start.getTime() + minutes * 60_000);

  const direction = minutes > 0 ? 1 : -1;
  let remaining = Math.abs(minutes);
  let cursor = DateTime.fromJSDate(start, { zone: policy.timezone });
  let day = cursor.startOf('day');
  const holidays = new Set(policy.holidays);
  const intervals = policy.workingHours.map((interval) => ({
    start: parseClock(interval.start),
    end: parseClock(interval.end),
  }));
  if (direction < 0) intervals.reverse();

  // Advance by work intervals and days, never minute by minute. Luxon preserves
  // local calendar days across timezone/DST changes.
  for (let days = 0; days < 36600; days++) {
    if (
      policy.workingDays.includes(day.weekday) &&
      !holidays.has(day.toISODate()!)
    ) {
      for (const interval of intervals) {
        const open = atMinute(day, interval.start);
        const close = atMinute(day, interval.end);
        const boundary = direction > 0 ? close : open;
        const candidate =
          direction > 0
            ? DateTime.max(cursor, open)
            : DateTime.min(cursor, close);
        const available =
          direction * boundary.diff(candidate, 'minutes').minutes;
        if (available <= 0) continue;
        if (remaining <= available)
          return candidate.plus({ minutes: direction * remaining }).toJSDate();
        remaining -= available;
      }
    }
    day = day.plus({ days: direction });
    cursor = direction > 0 ? day : day.plus({ days: 1 });
  }
  throw new BadRequestException(
    'SLA deadline is outside the supported calendar range',
  );
}

export function calculateTicketDeadlines(
  start: Date,
  priority: keyof SlaPolicyConfig['targets'],
  policy: SlaPolicyConfig,
) {
  const target = policy.targets[priority];
  const dueAt = addSlaMinutes(start, target.resolutionMinutes, policy);
  const firstResponseDueAt =
    target.responseMinutes === null
      ? null
      : addSlaMinutes(start, target.responseMinutes, policy);
  const warningAt = (deadline: Date, targetMinutes: number) =>
    policy.warningMinutes > 0
      ? addSlaMinutes(
          deadline,
          -Math.min(policy.warningMinutes, targetMinutes),
          policy,
        )
      : null;
  return {
    dueAt,
    firstResponseDueAt,
    responseWarningAt: firstResponseDueAt
      ? warningAt(firstResponseDueAt, target.responseMinutes!)
      : null,
    resolutionWarningAt: warningAt(dueAt, target.resolutionMinutes),
  };
}
