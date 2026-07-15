import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  ticket: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should get only own tickets for EMPLOYEE', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };

    const query = {
      page: 1,
      limit: 10,
    };

    mockPrismaService.ticket.findMany.mockResolvedValue([]);
    mockPrismaService.ticket.count.mockResolvedValue(0);

    const result = await service.getTickets(currentUser, query);

    expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdById: 10,
        }),
      }),
    );

    expect(result).toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
      },
    });
  });
});
