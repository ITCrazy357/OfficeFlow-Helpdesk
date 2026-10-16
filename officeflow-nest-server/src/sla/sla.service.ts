import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
import type { SlaPolicyConfig } from './sla-policy';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';

const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
];
type Milestone = 'RESPONSE' | 'RESOLUTION';
const ticketSelect = {
  id: true,
  title: true,
  status: true,
  createdById: true,
  assignedToId: true,
  dueAt: true,
  isOverdue: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  firstResponseOverdue: true,
  responseWarningAt: true,
  resolutionWarningAt: true,
  slaPolicy: true,
  assignedTo: {
    select: {
      manager: {
        select: { id: true, role: true, isActive: true, isLocked: true },
      },
    },
  },
} satisfies Prisma.TicketSelect;

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly outbox: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async markOverdueTickets() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const candidates = await this.prisma.ticket.findMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          OR: [
            { dueAt: { lte: now }, isOverdue: false },
            {
              firstResponseDueAt: { lte: now },
              firstRespondedAt: null,
              firstResponseOverdue: false,
            },
            {
              responseWarningAt: { lte: now },
              firstResponseDueAt: { gt: now },
              firstRespondedAt: null,
              slaAlerts: { none: { milestone: 'RESPONSE', kind: 'WARNING' } },
            },
            {
              resolutionWarningAt: { lte: now },
              dueAt: { gt: now },
              slaPolicy: { not: Prisma.DbNull },
              slaAlerts: { none: { milestone: 'RESOLUTION', kind: 'WARNING' } },
            },
          ],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!candidates.length) return;
      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, isActive: true, isLocked: false },
        select: { id: true },
      });
      let changed = 0;
      for (const candidate of candidates) {
        changed += await runSerializableTransaction(this.prisma, async (tx) => {
          const ticket = await tx.ticket.findUnique({
            where: { id: candidate.id },
            select: ticketSelect,
          });
          if (!ticket || !ACTIVE_STATUSES.includes(ticket.status)) return 0;
          let breaches = 0;
          const policy = ticket.slaPolicy as unknown as SlaPolicyConfig | null;
          for (const milestone of ['RESPONSE', 'RESOLUTION'] as const) {
            if (milestone === 'RESPONSE' && ticket.firstRespondedAt) continue;
            const deadline =
              milestone === 'RESPONSE'
                ? ticket.firstResponseDueAt
                : ticket.dueAt;
            const warningAt =
              milestone === 'RESPONSE'
                ? ticket.responseWarningAt
                : ticket.resolutionWarningAt;
            if (!deadline) continue;
            const recipients = [
              ...new Set(
                [ticket.createdById, ticket.assignedToId].filter(
                  (id): id is number => id !== null,
                ),
              ),
            ];
            if (deadline <= now) {
              const claimed = await tx.ticket.updateMany({
                where: {
                  id: ticket.id,
                  status: { in: ACTIVE_STATUSES },
                  ...(milestone === 'RESPONSE'
                    ? {
                        firstRespondedAt: null,
                        firstResponseDueAt: { lte: now },
                        firstResponseOverdue: false,
                      }
                    : { dueAt: { lte: now }, isOverdue: false }),
                },
                data:
                  milestone === 'RESPONSE'
                    ? { firstResponseOverdue: true }
                    : { isOverdue: true },
              });
              if (!claimed.count) continue;
              if (milestone === 'RESOLUTION') {
                await this.outbox.enqueue(tx, {
                  type: OUTBOX_EVENT_TYPES.TICKET_OVERDUE,
                  payload: {
                    ticketId: ticket.id,
                    ticketTitle: ticket.title,
                    recipientIds: recipients,
                  },
                  deduplicationKey: `ticket-overdue:${ticket.id}`,
                });
              } else {
                await this.enqueueAlert(
                  tx,
                  ticket,
                  milestone,
                  'BREACHED',
                  deadline,
                  recipients,
                );
              }
              const manager = ticket.assignedTo?.manager;
              const managerIds =
                policy?.escalation === 'ADMINS_AND_MANAGER' &&
                manager?.isActive &&
                !manager.isLocked &&
                manager.role !== UserRole.EMPLOYEE
                  ? [manager.id]
                  : [];
              const escalationIds =
                policy && policy.escalation !== 'NONE'
                  ? [
                      ...new Set([
                        ...admins.map((admin) => admin.id),
                        ...managerIds,
                      ]),
                    ]
                  : [];
              if (escalationIds.length)
                await this.enqueueAlert(
                  tx,
                  ticket,
                  milestone,
                  'ESCALATED',
                  deadline,
                  escalationIds,
                  managerIds[0] ?? null,
                );
              breaches++;
            } else if (policy && warningAt && warningAt <= now) {
              await this.enqueueAlert(
                tx,
                ticket,
                milestone,
                'WARNING',
                deadline,
                recipients,
              );
            }
          }
          return breaches;
        });
      }
      if (changed) {
        await this.events.emitAsync(
          DASHBOARD_CACHE_INVALIDATE_EVENT,
          new DashboardCacheInvalidatedEvent(
            'TICKET_OVERDUE',
            candidates[0].id,
          ),
        );
        this.logger.warn(`Recorded ${changed} SLA breaches`);
      }
    } finally {
      this.running = false;
    }
  }

  private async enqueueAlert(
    tx: Prisma.TransactionClient,
    ticket: { id: number; title: string },
    milestone: Milestone,
    kind: 'WARNING' | 'BREACHED' | 'ESCALATED',
    dueAt: Date,
    recipientIds: number[],
    managerId: number | null = null,
  ) {
    const claimed = await tx.slaAlert.createMany({
      data: [{ ticketId: ticket.id, milestone, kind, managerId }],
      skipDuplicates: true,
    });
    if (!claimed.count) return;
    await this.outbox.enqueue(tx, {
      type: OUTBOX_EVENT_TYPES.TICKET_SLA_ALERT,
      payload: {
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        milestone,
        kind,
        dueAt: dueAt.toISOString(),
        recipientIds,
      },
      deduplicationKey: `ticket-sla:${ticket.id}:${milestone}:${kind}`,
    });
  }
}
