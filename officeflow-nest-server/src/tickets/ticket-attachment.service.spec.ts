import { ForbiddenException, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketAttachmentService } from './ticket-attachment.service';

describe('TicketAttachmentService upload authorization', () => {
  const ticket = { id: 5, createdById: 2, createdBy: { departmentId: 7 } };
  const manager = { userId: 3, role: UserRole.MANAGER };
  const file = {
    originalname: 'report.pdf',
    mimetype: 'application/pdf',
    size: 12,
  } as Express.Multer.File;
  const uploaded = {
    publicId: 'test-upload',
    resourceType: 'raw',
    deliveryType: 'authenticated',
    format: 'pdf',
    secureUrl: 'https://res.cloudinary.com/test/raw/authenticated/test.pdf',
  };

  function setup() {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 8 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(0),
      },
      ticketAttachment: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 10, fileName: file.originalname }),
      },
      ticketHistory: { create: jest.fn() },
    };
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue({ departmentId: 7 }) },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const cloud = {
      uploadFile: jest.fn().mockResolvedValue(uploaded),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = db as unknown as PrismaService;
    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'cleanup-job' }),
    };
    const service = new TicketAttachmentService(
      prisma,
      cloud as unknown as CloudinaryService,
      outbox,
      new TicketAccessPolicyService(prisma),
    );
    return { service, tx, db, cloud, outbox };
  }

  it('rejects lost department access after upload and cleans up the uploaded asset', async () => {
    const { service, tx, cloud } = setup();
    await expect(
      service.uploadAttachment(ticket.id, file, manager),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.ticketAttachment.create).not.toHaveBeenCalled();
    expect(tx.ticketHistory.create).not.toHaveBeenCalled();
    expect(cloud.deleteFile).toHaveBeenCalledWith(
      uploaded.publicId,
      uploaded.resourceType,
      uploaded.deliveryType,
    );
  });

  it('rejects before upload when access was already revoked', async () => {
    const { service, db, cloud } = setup();
    db.user.findUnique.mockResolvedValue({ departmentId: 8 });
    await expect(
      service.uploadAttachment(ticket.id, file, manager),
    ).rejects.toThrow(ForbiddenException);
    expect(cloud.uploadFile).not.toHaveBeenCalled();
    expect(cloud.deleteFile).not.toHaveBeenCalled();
  });

  it('retries a database conflict without uploading the file twice', async () => {
    const { service, tx, db, cloud } = setup();
    tx.user.findUnique.mockResolvedValue({ departmentId: 7 });
    db.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('test conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.uploadAttachment(ticket.id, file, manager),
    ).resolves.toEqual({ id: 10, fileName: file.originalname });
    expect(cloud.uploadFile).toHaveBeenCalledTimes(1);
    expect(tx.ticketAttachment.create).toHaveBeenCalledTimes(1);
    expect(cloud.deleteFile).not.toHaveBeenCalled();
  });

  it('persists a cleanup job if immediate Cloudinary cleanup fails', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const { service, tx, cloud, outbox } = setup();
      cloud.deleteFile.mockRejectedValueOnce(
        new Error('Temporary storage outage'),
      );
      await expect(
        service.uploadAttachment(ticket.id, file, manager),
      ).rejects.toThrow(ForbiddenException);
      expect(outbox.enqueue).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          type: 'cloudinary.asset.delete',
          payload: {
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType,
            deliveryType: uploaded.deliveryType,
          },
        }),
      );
      expect(tx.ticketAttachment.create).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('preserves the original rejection if cleanup and its fallback queue both fail', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const { service, cloud, outbox } = setup();
      cloud.deleteFile.mockRejectedValueOnce(
        new Error('Temporary storage outage'),
      );
      outbox.enqueue.mockRejectedValueOnce(
        new Error('Temporary database outage'),
      );
      await expect(
        service.uploadAttachment(ticket.id, file, manager),
      ).rejects.toThrow(ForbiddenException);
    } finally {
      log.mockRestore();
    }
  });
});
