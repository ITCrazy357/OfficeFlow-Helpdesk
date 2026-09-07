import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { TicketStatus, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { SlaService } from './sla.service';

const mockTransaction = {
  ticket: {
    updateMany: jest.fn(),
  },
};

const mockPrismaService = {
  ticket: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventEmitter = {
  emitAsync: jest.fn().mockResolvedValue([]),
};

const mockOutboxService = {
  enqueue: jest.fn().mockResolvedValue({ id: 'outbox-event-id' }),
};

describe('SlaService', () => {
  let service: SlaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      async (
        callback: (transaction: typeof mockTransaction) => Promise<unknown>,
      ) => callback(mockTransaction),
    );

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
        {
          provide: OutboxService,
          useValue: mockOutboxService,
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
    mockTransaction.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await service.markOverdueTickets();

    expect(mockTransaction.ticket.updateMany).toHaveBeenCalledTimes(2);
    const [updateArgs] = mockTransaction.ticket.updateMany.mock.calls[0] as [
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
    expect(mockOutboxService.enqueue).toHaveBeenCalledTimes(1);
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        type: 'ticket.overdue',
        payload: {
          ticketId: 1,
          ticketTitle: 'First overdue ticket',
          recipientIds: [10, 20],
        },
      }),
    );
    expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
      'dashboard.cache.invalidate',
      expect.objectContaining({
        reason: 'TICKET_OVERDUE',
        entityId: 1,
      }),
    );
  });
});
