import { BadRequestException } from '@nestjs/common';
import { Prisma, TicketHistoryAction, TicketStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../prisma/prisma.service';
import { elapsedSlaMinutes } from '../sla/sla-calendar';
import type { SlaPolicyConfig } from '../sla/sla-policy';
import type { PerformanceQueryDto } from './dto/performance-query.dto';

const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const COMPLETED = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
const ACTIVE = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];
const DAY_MS = 86_400_000;
const BATCH_SIZE = 500;

export function getPerformanceRange(
  query: PerformanceQueryDto,
  now = new Date(),
) {
  const today = DateTime.fromJSDate(now, { zone: REPORT_TIMEZONE }).startOf(
    'day',
  );
  const to = query.to ?? today.toISODate()!;
  const from = query.from ?? today.minus({ days: 29 }).toISODate()!;
  const start = DateTime.fromISO(from, { zone: REPORT_TIMEZONE });
  const lastDay = DateTime.fromISO(to, { zone: REPORT_TIMEZONE });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    !start.isValid ||
    !lastDay.isValid ||
    start > lastDay ||
    lastDay > today ||
    lastDay.diff(start, 'days').days >= 366
  ) {
    throw new BadRequestException(
      'Use valid creation dates, from <= to <= today, at most 366 days',
    );
  }
  return {
    from,
    to,
    timezone: REPORT_TIMEZONE,
    start: start.toJSDate(),
    end: lastDay.plus({ days: 1 }).toJSDate(),
  };
}

export type PerformanceRange = ReturnType<typeof getPerformanceRange>;

/** One repeatable-read snapshot; bounded batches avoid loading every ticket/history. */
export async function loadPerformanceReport(
  prisma: PrismaService,
  scope: Prisma.TicketWhereInput,
  range: PerformanceRange,
) {
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const daily = new Map<
        string,
        { date: string; created: number; completed: number }
      >();
      for (
        let day = DateTime.fromJSDate(range.start, { zone: REPORT_TIMEZONE });
        day.toJSDate() < range.end;
        day = day.plus({ days: 1 })
      ) {
        const date = day.toISODate()!;
        daily.set(date, { date, created: 0, completed: 0 });
      }

      let total = 0;
      let completed = 0;
      let everCompleted = 0;
      let reopened = 0;
      let legacyCalendarTickets = 0;
      let responseTotal = 0;
      let responseSamples = 0;
      let resolutionTotal = 0;
      let resolutionSamples = 0;
      let cursor = 0;
      while (true) {
        const tickets = await tx.ticket.findMany({
          where: {
            AND: [
              scope,
              {
                createdAt: { gte: range.start, lt: range.end, lte: now },
                id: { gt: cursor },
              },
            ],
          },
          select: {
            id: true,
            createdAt: true,
            status: true,
            firstRespondedAt: true,
            resolveAt: true,
            slaPolicy: true,
          },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        });
        if (!tickets.length) break;
        const transitions = await tx.ticketHistory.groupBy({
          by: ['ticketId', 'oldValue', 'newValue'],
          where: {
            ticketId: { in: tickets.map((ticket) => ticket.id) },
            action: TicketHistoryAction.STATUS_CHANGED,
            createdAt: { lte: now },
            OR: [
              { newValue: { in: COMPLETED } },
              { oldValue: { in: COMPLETED }, newValue: { in: ACTIVE } },
            ],
          },
        });
        const previouslyCompleted = new Set(
          transitions.map((row) => row.ticketId),
        );
        const reopenedIds = new Set(
          transitions
            .filter(
              (row) =>
                COMPLETED.some((status) => status === row.oldValue) &&
                ACTIVE.some((status) => status === row.newValue),
            )
            .map((row) => row.ticketId),
        );

        for (const ticket of tickets) {
          total++;
          const date = DateTime.fromJSDate(ticket.createdAt, {
            zone: REPORT_TIMEZONE,
          }).toISODate()!;
          const day = daily.get(date)!;
          day.created++;
          const isCompleted = COMPLETED.some(
            (status) => status === ticket.status,
          );
          if (isCompleted) {
            completed++;
            day.completed++;
          }
          if (isCompleted || previouslyCompleted.has(ticket.id))
            everCompleted++;
          if (reopenedIds.has(ticket.id)) reopened++;
          if (!ticket.slaPolicy) legacyCalendarTickets++;
          const policy = ticket.slaPolicy as unknown as SlaPolicyConfig | null;
          const duration = (end: Date | null) =>
            end && end >= ticket.createdAt && end <= now
              ? elapsedSlaMinutes(ticket.createdAt, end, policy)
              : null;
          const response = duration(ticket.firstRespondedAt);
          const resolution = isCompleted ? duration(ticket.resolveAt) : null;
          if (response !== null) {
            responseTotal += response;
            responseSamples++;
          }
          if (resolution !== null) {
            resolutionTotal += resolution;
            resolutionSamples++;
          }
        }
        cursor = tickets[tickets.length - 1].id;
        if (tickets.length < BATCH_SIZE) break;
      }

      // Backlog is current across ALL creation dates. Age uses elapsed 24-hour days,
      // not SLA days: tickets created outside work hours must remain visible.
      const buckets = [
        { key: 'under-1', label: 'Dưới 1 ngày', min: 0, max: 1 },
        { key: '1-3', label: '1–dưới 3 ngày', min: 1, max: 3 },
        { key: '3-7', label: '3–dưới 7 ngày', min: 3, max: 7 },
        { key: '7-14', label: '7–dưới 14 ngày', min: 7, max: 14 },
        { key: '14-plus', label: 'Từ 14 ngày', min: 14, max: null },
      ];
      const backlog = [] as Array<{
        key: string;
        label: string;
        total: number;
      }>;
      for (const bucket of buckets) {
        const count = await tx.ticket.count({
          where: {
            AND: [
              scope,
              {
                status: { in: ACTIVE },
                createdAt: {
                  ...(bucket.max === null
                    ? {}
                    : { gt: new Date(now.getTime() - bucket.max * DAY_MS) }),
                  lte: new Date(now.getTime() - bucket.min * DAY_MS),
                },
              },
            ],
          },
        });
        backlog.push({ key: bucket.key, label: bucket.label, total: count });
      }
      const average = (minutes: number, samples: number) => ({
        minutes: samples ? Math.round((minutes / samples) * 100) / 100 : null,
        samples,
      });
      return {
        range: { from: range.from, to: range.to, timezone: range.timezone },
        generatedAt: now.toISOString(),
        cohort: {
          total,
          completed,
          everCompleted,
          reopened,
          legacyCalendarTickets,
          reopenRate: everCompleted
            ? Math.round((reopened / everCompleted) * 10000) / 100
            : null,
          firstResponse: average(responseTotal, responseSamples),
          resolution: average(resolutionTotal, resolutionSamples),
        },
        daily: [...daily.values()],
        backlog,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    },
  );
}
