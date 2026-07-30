import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogAction, AuditLogEntity, type Prisma } from '@prisma/client';

import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should create an audit log with the provided transaction', async () => {
    const createAuditLog = jest.fn().mockResolvedValue({ id: 1 });
    const transaction = {
      auditLog: {
        create: createAuditLog,
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.create(
        {
          actorId: 1,
          entity: AuditLogEntity.TICKET,
          entityId: 10,
          action: AuditLogAction.UPDATE,
          description: 'Updated ticket.',
        },
        transaction,
      ),
    ).resolves.toEqual({ id: 1 });

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
  });

  it('should apply pagination and all supported filters', async () => {
    mockPrismaService.auditLog.findMany.mockResolvedValue([]);
    mockPrismaService.auditLog.count.mockResolvedValue(0);

    await service.findAll({
      page: 2,
      limit: 20,
      entity: AuditLogEntity.ASSET,
      action: AuditLogAction.ASSIGNED,
      actorId: 1,
      entityId: 5,
      keyword: ' laptop ',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
    });

    expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: {
          entity: AuditLogEntity.ASSET,
          action: AuditLogAction.ASSIGNED,
          actorId: 1,
          entityId: 5,
          description: {
            contains: 'laptop',
          },
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.999Z'),
          },
        },
      }),
    );
  });

  it('should reject an invalid date range', async () => {
    await expect(
      service.findAll({
        from: '2026-07-31T23:59:59.999Z',
        to: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw when an audit log does not exist', async () => {
    mockPrismaService.auditLog.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
