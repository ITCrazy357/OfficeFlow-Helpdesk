import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { TicketStatus, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from './sla.service';

const mockPrismaService = {
  ticket: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('SlaService', () => {
  let service: SlaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
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

    service = module.get(SlaService);
  });

  it('should notify only for tickets atomically claimed by this worker', async () => {
    mockPrismaService.ticket.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'First overdue ticket',
        createdById: 10,
        assignedToId: 20,
      },
      {
        id: 2,
        title: 'Already claimed ticket',
        createdById: 11,
        assignedToId: null,
      },
    ]);
    mockPrismaService.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await service.markOverdueTickets();

    expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledTimes(2);
    const [updateArgs] = mockPrismaService.ticket.updateMany.mock.calls[0] as [
      Prisma.TicketUpdateManyArgs,
    ];
    expect(updateArgs.where).toMatchObject({
      id: 1,
      isOverdue: false,
      status: {
        notIn: [
          TicketStatus.RESOLVED,
          TicketStatus.CLOSED,
          TicketStatus.CANCELLED,
        ],
      },
    });
    expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'ticket.overdue',
      expect.objectContaining({
        ticketId: 1,
        recipientIds: [10, 20],
      }),
    );
  });
});
