import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveStatus, Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { LeaveRequestService } from './leave-requests.service';

const mockTransaction = {
  user: {
    findUnique: jest.fn(),
  },
  leaveRequest: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrismaService = {
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
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

    mockPrismaService.$transaction.mockImplementation(
      async (
        callback: (transaction: typeof mockTransaction) => Promise<unknown>,
      ) => callback(mockTransaction),
    );

    mockTransaction.user.findUnique.mockResolvedValue({
      manager: activeManager,
    });
    mockTransaction.leaveRequest.findFirst.mockResolvedValue(null);

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
});
