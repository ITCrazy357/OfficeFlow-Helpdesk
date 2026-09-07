import type { Prisma } from '@prisma/client';

import { OUTBOX_EVENT_TYPES } from './outbox.constants';
import { OutboxService } from './outbox.service';

const mockOutboxEvent = {
  create: jest.fn(),
};

const mockClient = {
  outboxEvent: mockOutboxEvent,
};

describe('OutboxService', () => {
  const service = new OutboxService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOutboxEvent.create.mockResolvedValue({ id: 'event-id' });
  });

  it('stores a typed event using the supplied transaction client', async () => {
    await expect(
      service.enqueue(
        mockClient as unknown as Pick<Prisma.TransactionClient, 'outboxEvent'>,
        {
          type: OUTBOX_EVENT_TYPES.TICKET_CREATED,
          payload: { ticketId: 42 },
          deduplicationKey: 'ticket-created:42',
        },
      ),
    ).resolves.toEqual({ id: 'event-id' });

    expect(mockOutboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: 'ticket.created',
        payload: { ticketId: 42 },
        deduplicationKey: 'ticket-created:42',
        availableAt: undefined,
      },
      select: { id: true },
    });
  });

  it('refuses to persist nested secrets', () => {
    expect(() =>
      service.enqueue(
        mockClient as unknown as Pick<Prisma.TransactionClient, 'outboxEvent'>,
        {
          type: OUTBOX_EVENT_TYPES.USER_CREATED,
          payload: {
            userId: 7,
            metadata: { rawToken: 'must-not-be-persisted' },
          },
        },
      ),
    ).toThrow('Sensitive field "rawToken" cannot be stored in outbox');

    expect(mockOutboxEvent.create).not.toHaveBeenCalled();
  });
});
