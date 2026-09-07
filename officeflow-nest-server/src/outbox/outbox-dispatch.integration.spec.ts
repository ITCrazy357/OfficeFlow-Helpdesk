import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxStatus } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TicketEmailListener } from '../mail/listeners/ticket-email.listener';
import { MailService } from '../mail/mail.service';
import { NotificationsListener } from '../notifications/notifications.listener';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryCleanupListener } from './cloudinary-cleanup.listener';
import { OutboxProcessor } from './outbox.processor';

// Jest matchers return any; keep nested expected values explicitly unknown.
function objectContaining(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Outbox dispatch through real Nest event subscribers', () => {
  let module: TestingModule;
  let processor: OutboxProcessor;
  const database = {
    outboxEvent: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { createMany: jest.fn() },
  };
  const cloudinary = { deleteFile: jest.fn() };
  const mail = { isEnabled: () => true, sendEmail: jest.fn() };
  const cleanup = {
    id: '32fa383b-31af-47f6-bb5f-2f434efb5bc4',
    type: 'cloudinary.asset.delete',
    attempts: 0,
    payload: {
      publicId: 'test/report.pdf',
      resourceType: 'raw',
      deliveryType: 'authenticated',
    },
  };
  const assignment = {
    ...cleanup,
    type: 'ticket.assigned',
    payload: {
      ticketId: 42,
      ticketTitle: 'VPN issue',
      assignedToId: 7,
      assignedByName: 'Admin',
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    database.outboxEvent.findMany.mockResolvedValue([cleanup]);
    database.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    database.user.findUnique.mockResolvedValue({
      name: 'IT Staff',
      email: 'it@example.com',
      isActive: true,
    });
    database.notification.createMany.mockResolvedValue({ count: 1 });
    cloudinary.deleteFile.mockResolvedValue(undefined);
    mail.sendEmail.mockResolvedValue(undefined);
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        OutboxProcessor,
        CloudinaryCleanupListener,
        TicketEmailListener,
        NotificationsListener,
        NotificationsService,
        { provide: PrismaService, useValue: database },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    await module.init();
    processor = module.get(OutboxProcessor);
  });

  afterEach(async () => {
    await module.close();
  });

  it('does not mark cleanup processed until the Cloudinary listener finishes', async () => {
    const started = deferred();
    const finished = deferred();
    cloudinary.deleteFile.mockImplementation(async () => {
      started.resolve();
      await finished.promise;
    });
    const processing = processor.processBatch();
    try {
      await started.promise;
      expect(database.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
    } finally {
      finished.resolve();
      await processing;
    }
    expect(database.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      objectContaining({
        data: objectContaining({ status: OutboxStatus.PROCESSED }),
      }),
    );
  });

  it('retries a failed Cloudinary call through the real decorator wrapper', async () => {
    cloudinary.deleteFile.mockRejectedValueOnce(
      new Error('Cloudinary unavailable'),
    );
    await processor.processBatch();
    expect(database.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      objectContaining({
        data: objectContaining({
          status: OutboxStatus.FAILED,
          lastError: 'Cloudinary unavailable',
        }),
      }),
    );
    database.outboxEvent.findMany.mockResolvedValue([
      { ...cleanup, attempts: 1 },
    ]);
    await processor.processBatch();
    expect(cloudinary.deleteFile).toHaveBeenCalledTimes(2);
    expect(database.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      objectContaining({
        data: objectContaining({ status: OutboxStatus.PROCESSED }),
      }),
    );
  });

  it('waits for mail and forwards a stable event id to notification deduplication', async () => {
    database.outboxEvent.findMany.mockResolvedValue([assignment]);
    const started = deferred();
    const finished = deferred();
    mail.sendEmail.mockImplementation(async () => {
      started.resolve();
      await finished.promise;
    });
    const processing = processor.processBatch();
    try {
      await started.promise;
      expect(database.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
      expect(database.notification.createMany).toHaveBeenCalledWith({
        data: [objectContaining({ userId: 7, sourceEventId: cleanup.id })],
        skipDuplicates: true,
      });
    } finally {
      finished.resolve();
      await processing;
    }
  });

  it('propagates SMTP failure even if notification creation succeeds', async () => {
    database.outboxEvent.findMany.mockResolvedValue([assignment]);
    mail.sendEmail.mockRejectedValue(new Error('SMTP unavailable'));
    await processor.processBatch();
    expect(database.notification.createMany).toHaveBeenCalled();
    expect(database.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      objectContaining({
        data: objectContaining({
          status: OutboxStatus.FAILED,
          lastError: 'SMTP unavailable',
        }),
      }),
    );
  });
});
