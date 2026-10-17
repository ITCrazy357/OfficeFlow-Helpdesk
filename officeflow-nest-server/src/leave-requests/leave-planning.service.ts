import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  LeavePeriod,
  LeaveStatus,
  LeaveType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import { PrismaService } from '../prisma/prisma.service';
import { SlaPolicyService } from '../sla/sla-policy.service';
import {
  leaveDate,
  leaveMonth,
  leaveToday,
  leaveWorkingDays,
} from './leave-calendar';
import {
  LeaveBalanceQueryDto,
  LeaveCalendarQueryDto,
  LeavePreviewDto,
  SetLeaveEntitlementDto,
} from './dto/leave-planning.dto';

@Injectable()
export class LeavePlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: SlaPolicyService,
    private readonly audit: AuditLogsService,
  ) {}

  async plan(tx: Prisma.TransactionClient, dto: LeavePreviewDto) {
    const { config } = await this.policies.get(tx);
    const calendar = {
      timezone: config.timezone,
      workingDays: config.workingDays,
      holidays: config.holidays,
    };
    const days = leaveWorkingDays(
      dto.startDate,
      dto.endDate,
      dto.period ?? LeavePeriod.FULL_DAY,
      calendar,
    );
    if (dto.startDate < leaveToday(calendar.timezone))
      throw new BadRequestException('Start date can not be in the past');
    return { calendar, days };
  }

  async balance(tx: Prisma.TransactionClient, userId: number, year: number) {
    const [entitlement, usage, legacyRequests] = await Promise.all([
      tx.leaveEntitlement.findUnique({
        where: { userId_year: { userId, year } },
      }),
      tx.leaveDay.findMany({
        where: {
          date: {
            gte: leaveDate(`${year}-01-01`),
            lte: leaveDate(`${year}-12-31`),
          },
          request: {
            requesterId: userId,
            type: LeaveType.ANNUAL,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
          },
        },
        select: { halfDays: true, request: { select: { status: true } } },
      }),
      tx.leaveRequest.count({
        where: {
          requesterId: userId,
          type: LeaveType.LEGACY,
          status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
          startDate: { lte: leaveDate(`${year}-12-31`) },
          endDate: { gte: leaveDate(`${year}-01-01`) },
        },
      }),
    ]);
    const used =
      usage
        .filter((day) => day.request.status === LeaveStatus.APPROVED)
        .reduce((sum, day) => sum + day.halfDays, 0) / 2;
    const reserved =
      usage
        .filter((day) => day.request.status === LeaveStatus.PENDING)
        .reduce((sum, day) => sum + day.halfDays, 0) / 2;
    return {
      userId,
      year,
      allowance: entitlement ? entitlement.halfDays / 2 : null,
      used,
      reserved,
      remaining: entitlement
        ? entitlement.halfDays / 2 - used - reserved
        : null,
      version: entitlement?.version ?? 0,
      legacyRequests,
    };
  }

  async assertAvailable(
    tx: Prisma.TransactionClient,
    userId: number,
    days: Array<{ date: Date; halfDays: number }>,
  ) {
    const years = new Map<number, number>();
    for (const day of days)
      years.set(
        day.date.getUTCFullYear(),
        (years.get(day.date.getUTCFullYear()) ?? 0) + day.halfDays,
      );
    for (const [year, halfDays] of years) {
      const balance = await this.balance(tx, userId, year);
      if (balance.remaining === null)
        throw new UnprocessableEntityException(
          `Annual leave allowance is not configured for ${year}`,
        );
      if (halfDays / 2 > balance.remaining)
        throw new ConflictException(
          `Insufficient annual leave balance for ${year}`,
        );
    }
  }

  async getBalance(query: LeaveBalanceQueryDto, actor: CurrentUserPayload) {
    const userId = query.userId ?? actor.userId;
    if (userId !== actor.userId && actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Forbidden');
    return this.prisma.$transaction(
      (tx) => this.balance(tx, userId, query.year),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async setEntitlement(
    userId: number,
    year: number,
    dto: SetLeaveEntitlementDto,
    actor: CurrentUserPayload,
  ) {
    if (actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Forbidden');
    return runSerializableTransaction(this.prisma, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('User not found');
      const previous = await this.balance(tx, userId, year);
      if (previous.version !== dto.version)
        throw new ConflictException(
          'Leave allowance changed. Reload before saving',
        );
      if (dto.days < previous.used + previous.reserved)
        throw new ConflictException(
          'Allowance cannot be lower than used and reserved leave',
        );
      await tx.leaveEntitlement.upsert({
        where: { userId_year: { userId, year } },
        create: { userId, year, halfDays: dto.days * 2 },
        update: { halfDays: dto.days * 2, version: { increment: 1 } },
      });
      await this.audit.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.LEAVE_REQUEST,
          entityId: null,
          action: AuditLogAction.UPDATE,
          description: `Updated annual leave allowance for user ${userId}, year ${year}.`,
          oldValues: { userId, year, days: previous.allowance },
          newValues: { userId, year, days: dto.days },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        tx,
      );
      return this.balance(tx, userId, year);
    }).catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Leave allowance changed. Reload before saving',
        );
      throw error;
    });
  }

  async preview(dto: LeavePreviewDto, actor: CurrentUserPayload) {
    return this.prisma.$transaction(
      async (tx) => {
        const { calendar, days } = await this.plan(tx, dto);
        const years = [
          ...new Set(days.map((day) => day.date.getUTCFullYear())),
        ];
        const balances = await Promise.all(
          years.map((year) => this.balance(tx, actor.userId, year)),
        );
        return {
          days: days.reduce((sum, day) => sum + day.halfDays, 0) / 2,
          calendar,
          balances,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async calendar(query: LeaveCalendarQueryDto, actor: CurrentUserPayload) {
    const { start, end } = leaveMonth(query.month);
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { departmentId: true },
    });
    const departmentId = query.departmentId ?? user?.departmentId;
    if (!departmentId)
      return {
        departmentId: null,
        items: [],
        totalItems: 0,
        page: query.page ?? 1,
        totalPages: 0,
      };
    if (actor.role !== UserRole.ADMIN && departmentId !== user?.departmentId)
      throw new ForbiddenException('Forbidden');
    const where: Prisma.LeaveRequestWhereInput = {
      requester: { departmentId },
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      startDate: { lte: end },
      endDate: { gte: start },
      OR: [
        { type: LeaveType.LEGACY },
        { days: { some: { date: { gte: start, lte: end } } } },
      ],
    };
    const page = query.page ?? 1;
    const [items, totalItems] = await this.prisma.$transaction(
      [
        this.prisma.leaveRequest.findMany({
          where,
          skip: (page - 1) * 100,
          take: 100,
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
          // Team members see availability, never private reasons or leave types.
          select: {
            id: true,
            startDate: true,
            endDate: true,
            period: true,
            status: true,
            requester: { select: { id: true, name: true } },
            days: {
              where: { date: { gte: start, lte: end } },
              select: { date: true, halfDays: true },
            },
          },
        }),
        this.prisma.leaveRequest.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      departmentId,
      items,
      totalItems,
      page,
      totalPages: Math.ceil(totalItems / 100),
    };
  }
}
