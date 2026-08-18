import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveStatus, Prisma, UserRole } from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';

import { LeaveRequestService } from './leave-requests.service';

const mockTransaction = {
  user: {
    findUnique: jest.fn(),
  },
  leaveRequest: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
};

const mockPrismaService = {
  leaveRequest: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

type AuditParams = {
  entity?: string;
  entityId?: number;
  action?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
};

const mockAuditLogsService = {
  create: jest.fn<Promise<unknown>, [AuditParams, unknown?]>(),
};

const currentUser = {
  userId: 10,
  role: UserRole.EMPLOYEE,
};

const createDto = {
  startDate: '2026-09-10',
  endDate: '2026-09-12',
  reason: 'Family appointment',
};

const activeManager = {
  id: 20,
  role: UserRole.MANAGER,
  isActive: true,
  isLocked: false,
};

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T08:00:00.000Z'));

    mockPrismaService.$transaction.mockImplementation((input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input as Promise<unknown>[]);
      }

      const callback = input as (
        transaction: typeof mockTransaction,
      ) => Promise<unknown>;

      return callback(mockTransaction);
    });

    mockTransaction.user.findUnique.mockResolvedValue({
      manager: activeManager,
    });
    mockTransaction.leaveRequest.findFirst.mockResolvedValue(null);
    mockTransaction.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    mockAuditLogsService.create.mockResolvedValue({ id: 1 });
    mockPrismaService.leaveRequest.findMany.mockResolvedValue([]);
    mockPrismaService.leaveRequest.count.mockResolvedValue(0);
    mockPrismaService.leaveRequest.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<LeaveRequestService>(LeaveRequestService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a request, returns it, and emits after the transaction succeeds', async () => {
    const created = {
      id: 30,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      reason: createDto.reason,
      status: LeaveStatus.PENDING,
      createdAt: new Date('2026-09-01T08:00:00.000Z'),
      approver: {
        id: activeManager.id,
        name: 'Manager',
      },
    };
    mockTransaction.leaveRequest.create.mockResolvedValue(created);

    const result = await service.create(createDto, currentUser);

    expect(result).toEqual(created);
    expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    expect(mockTransaction.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentUser.userId },
      }),
    );
    expect(mockTransaction.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requesterId: currentUser.userId,
          approverId: activeManager.id,
          reason: createDto.reason,
        }) as Record<string, unknown>,
      }),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'leave.requested',
      expect.objectContaining({ leaveRequestId: created.id }),
    );
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'LEAVE_REQUEST',
        entityId: created.id,
        action: 'CREATE',
      }),
      mockTransaction,
    );
    const createAuditParams = mockAuditLogsService.create.mock.calls[0]?.[0];
    expect(createAuditParams?.newValues).not.toHaveProperty('reason');
  });

  it('rejects an invalid date range before opening a transaction', async () => {
    await expect(
      service.create(
        {
          ...createDto,
          startDate: '2026-09-13',
          endDate: '2026-09-12',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['inactive', { ...activeManager, isActive: false }],
    ['locked', { ...activeManager, isLocked: true }],
  ])('rejects a %s manager', async (_label, manager) => {
    mockTransaction.user.findUnique.mockResolvedValue({ manager });

    await expect(service.create(createDto, currentUser)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    expect(mockTransaction.leaveRequest.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects a manager whose role cannot approve leave', async () => {
    mockTransaction.user.findUnique.mockResolvedValue({
      manager: {
        ...activeManager,
        role: UserRole.EMPLOYEE,
      },
    });

    await expect(service.create(createDto, currentUser)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects a request that overlaps pending or approved leave', async () => {
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({ id: 99 });

    await expect(service.create(createDto, currentUser)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(mockTransaction.leaveRequest.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('retries one serializable transaction write conflict', async () => {
    const writeConflict = new Prisma.PrismaClientKnownRequestError(
      'Write conflict',
      {
        code: 'P2034',
        clientVersion: '7.9.1',
      },
    );
    const created = {
      id: 31,
      startDate: new Date('2026-09-10T00:00:00.000Z'),
      endDate: new Date('2026-09-12T00:00:00.000Z'),
      reason: createDto.reason,
      status: LeaveStatus.PENDING,
      createdAt: new Date('2026-09-01T08:00:00.000Z'),
      approver: {
        id: activeManager.id,
        name: 'Manager',
      },
    };
    mockPrismaService.$transaction.mockRejectedValueOnce(writeConflict);
    mockTransaction.leaveRequest.create.mockResolvedValue(created);

    await expect(service.create(createDto, currentUser)).resolves.toEqual(
      created,
    );

    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('returns only requests created by the current user, including for ADMIN', async () => {
    const admin = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const items = [
      {
        id: 40,
        reason: 'Private medical appointment',
        status: LeaveStatus.PENDING,
      },
    ];
    mockPrismaService.leaveRequest.findMany.mockResolvedValue(items);
    mockPrismaService.leaveRequest.count.mockResolvedValue(1);

    const result = await service.findMine(admin, {
      page: 2,
      limit: 5,
      status: LeaveStatus.PENDING,
    });

    expect(mockPrismaService.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requesterId: admin.userId,
          status: LeaveStatus.PENDING,
        },
        skip: 5,
        take: 5,
      }),
    );
    expect(mockPrismaService.leaveRequest.count).toHaveBeenCalledWith({
      where: {
        requesterId: admin.userId,
        status: LeaveStatus.PENDING,
      },
    });
    expect(result).toEqual({
      items,
      pagination: {
        page: 2,
        limit: 5,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });

  it('returns only pending requests assigned to the current approver', async () => {
    const adminApprover = {
      userId: 20,
      role: UserRole.ADMIN,
    };

    await service.findPendingApproval(adminApprover, {
      page: 1,
      limit: 10,
    });

    expect(mockPrismaService.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          approverId: adminApprover.userId,
          status: LeaveStatus.PENDING,
        },
      }),
    );
    expect(mockPrismaService.leaveRequest.count).toHaveBeenCalledWith({
      where: {
        approverId: adminApprover.userId,
        status: LeaveStatus.PENDING,
      },
    });
  });

  it('gets a request only when the user is its requester or assigned approver', async () => {
    const leaveRequest = {
      id: 41,
      reason: 'Private reason',
      status: LeaveStatus.PENDING,
    };
    mockPrismaService.leaveRequest.findFirst.mockResolvedValue(leaveRequest);

    await expect(service.findOne(41, currentUser)).resolves.toEqual(
      leaveRequest,
    );

    expect(mockPrismaService.leaveRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 41,
          OR: [{ requesterId: currentUser.userId }],
        },
      }),
    );
  });

  it('does not grant ADMIN access to an unrelated leave request', async () => {
    const admin = { userId: 1, role: UserRole.ADMIN };

    await expect(service.findOne(41, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mockPrismaService.leaveRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 41,
          OR: [{ requesterId: admin.userId }, { approverId: admin.userId }],
        },
      }),
    );
  });

  it('does not expose the approval queue to non-approver roles', async () => {
    await expect(
      service.findPendingApproval(currentUser, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockPrismaService.leaveRequest.findMany).not.toHaveBeenCalled();
  });

  it('approves an assigned pending request, audits it, then emits an event', async () => {
    const approver = { userId: 20, role: UserRole.MANAGER };
    const approved = {
      id: 42,
      status: LeaveStatus.APPROVED,
    };
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({
      id: 42,
      requesterId: 10,
      status: LeaveStatus.PENDING,
    });
    mockTransaction.leaveRequest.findUniqueOrThrow.mockResolvedValue(approved);

    await expect(service.approve(42, approver)).resolves.toEqual(approved);

    expect(mockTransaction.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 42,
          approverId: approver.userId,
          status: LeaveStatus.PENDING,
        },
        data: expect.objectContaining({
          status: LeaveStatus.APPROVED,
          reviewedById: approver.userId,
        }) as Record<string, unknown>,
      }),
    );
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'LEAVE_REQUEST',
        action: 'STATUS_CHANGED',
        oldValues: { status: LeaveStatus.PENDING },
        newValues: expect.objectContaining({
          status: LeaveStatus.APPROVED,
        }) as Record<string, unknown>,
      }),
      mockTransaction,
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'leave.approved',
      expect.objectContaining({ leaveRequestId: approved.id }),
    );
  });

  it('rejects with a review note without copying that note into audit logs', async () => {
    const approver = { userId: 20, role: UserRole.ADMIN };
    const rejected = {
      id: 43,
      status: LeaveStatus.REJECTED,
      reviewNote: 'Coverage is unavailable',
    };
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({
      id: 43,
      requesterId: 10,
      status: LeaveStatus.PENDING,
    });
    mockTransaction.leaveRequest.findUniqueOrThrow.mockResolvedValue(rejected);

    await service.reject(
      43,
      { reviewNote: 'Coverage is unavailable' },
      approver,
    );

    expect(mockTransaction.leaveRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaveStatus.REJECTED,
          reviewNote: 'Coverage is unavailable',
        }) as Record<string, unknown>,
      }),
    );
    const auditParams = mockAuditLogsService.create.mock.calls[0]?.[0];
    expect(auditParams.oldValues).not.toHaveProperty('reviewNote');
    expect(auditParams.newValues).not.toHaveProperty('reviewNote');
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'leave.rejected',
      expect.objectContaining({ leaveRequestId: rejected.id }),
    );
  });

  it('requires a non-empty review note for rejection inside the service', async () => {
    const approver = { userId: 20, role: UserRole.MANAGER };

    await expect(
      service.reject(43, { reviewNote: '   ' }, approver),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('rejects review attempts from a user without an approver role', async () => {
    await expect(service.approve(42, currentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('returns not found when an ADMIN is not the assigned approver', async () => {
    const unrelatedAdmin = { userId: 99, role: UserRole.ADMIN };

    await expect(service.approve(42, unrelatedAdmin)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('returns conflict when another reviewer processes the request first', async () => {
    const approver = { userId: 20, role: UserRole.MANAGER };
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({
      id: 42,
      requesterId: 10,
      status: LeaveStatus.PENDING,
    });
    mockTransaction.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.approve(42, approver)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('allows only the requester to cancel a pending request', async () => {
    const cancelled = {
      id: 44,
      status: LeaveStatus.CANCELLED,
    };
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({
      id: 44,
      status: LeaveStatus.PENDING,
    });
    mockTransaction.leaveRequest.findUniqueOrThrow.mockResolvedValue(cancelled);

    await expect(service.cancel(44, currentUser)).resolves.toEqual(cancelled);

    expect(mockTransaction.leaveRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 44,
          requesterId: currentUser.userId,
        },
      }),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'leave.cancelled',
      expect.objectContaining({ leaveRequestId: cancelled.id }),
    );
  });

  it('does not allow cancelling a processed request', async () => {
    mockTransaction.leaveRequest.findFirst.mockResolvedValue({
      id: 44,
      status: LeaveStatus.APPROVED,
    });

    await expect(service.cancel(44, currentUser)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(mockTransaction.leaveRequest.updateMany).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });
});
