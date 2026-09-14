import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TicketHistoryAction, UserRole } from '@prisma/client';
import type { Request } from 'express';
import type {} from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { normalizeAttachmentFileName } from './ticket-attachment.util';
import {
  resolveCloudinaryDeliveryType,
  resolveCloudinaryResourceType,
  resolveAttachmentContentType,
} from './ticket-delivery.util';

export type TicketAttachmentFile = NonNullable<Request['file']>;

type AttachmentDeliveryMetadata = {
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  publicId: string | null;
  resourceType: string | null;
  deliveryType: string;
  format: string | null;
};

@Injectable()
export class TicketAttachmentService {
  private readonly logger = new Logger(TicketAttachmentService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly outboxService: OutboxService,
    private readonly access: TicketAccessPolicyService,
  ) {}
  async uploadAttachment(
    ticketId: number,
    file: TicketAttachmentFile,
    currentUser: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    await this.access.canAccessTicket(ticketId, currentUser);

    const fileName = normalizeAttachmentFileName(file.originalname);

    const uploadedFile = await this.cloudinaryService.uploadFile(
      file,
      'officeflow/ticket-attachments',
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const attachment = await transaction.ticketAttachment.create({
          data: {
            ticketId,
            uploadedById: currentUser.userId,
            fileName,
            fileType: file.mimetype,
            fileSize: file.size,
            fileUrl: uploadedFile.secureUrl,
            publicId: uploadedFile.publicId,
            resourceType: uploadedFile.resourceType,
            deliveryType: uploadedFile.deliveryType,
            format: uploadedFile.format,
          },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

        await transaction.ticketHistory.create({
          data: {
            ticketId,
            userId: currentUser.userId,
            action: TicketHistoryAction.ATTACHMENT_ADDED,
            newValue: attachment.fileName,
          },
        });

        return attachment;
      });
    } catch (error) {
      try {
        await this.cloudinaryService.deleteFile(
          uploadedFile.publicId,
          uploadedFile.resourceType,
          uploadedFile.deliveryType,
        );
      } catch (cleanupError) {
        this.logger.error(
          `Could not clean up Cloudinary asset ${uploadedFile.publicId}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      throw error;
    }
  }

  async getAttachments(ticketId: number, currentUser: CurrentUserPayload) {
    await this.access.canAccessTicket(ticketId, currentUser);

    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return attachments;
  }

  private async getAttachmentDeliveryMetadata(
    ticketId: number,
    attachmentId: number,
    currentUser: CurrentUserPayload,
  ): Promise<AttachmentDeliveryMetadata> {
    await this.access.canAccessTicket(ticketId, currentUser);

    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: {
        id: attachmentId,
        ticketId,
      },
      select: {
        fileName: true,
        fileUrl: true,
        fileType: true,
        publicId: true,
        resourceType: true,
        deliveryType: true,
        format: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  private createAttachmentAccessUrl(
    attachment: AttachmentDeliveryMetadata,
    asAttachment: boolean,
  ) {
    const deliveryType = resolveCloudinaryDeliveryType(attachment.deliveryType);

    if (deliveryType === 'upload') {
      return {
        url: attachment.fileUrl,
        expiresAt: null,
      };
    }

    if (!attachment.publicId || !attachment.format) {
      throw new InternalServerErrorException(
        'Attachment delivery metadata is incomplete',
      );
    }

    return this.cloudinaryService.createPrivateDownloadUrl(
      attachment.publicId,
      attachment.format,
      resolveCloudinaryResourceType(
        attachment.resourceType,
        attachment.fileUrl,
      ),
      deliveryType,
      asAttachment,
    );
  }

  async getAttachmentAccessUrl(
    ticketId: number,
    attachmentId: number,
    currentUser: CurrentUserPayload,
    asAttachment: boolean,
  ) {
    const attachment = await this.getAttachmentDeliveryMetadata(
      ticketId,
      attachmentId,
      currentUser,
    );

    return this.createAttachmentAccessUrl(attachment, asAttachment);
  }

  async downloadAttachment(
    ticketId: number,
    attachmentId: number,
    currentUser: CurrentUserPayload,
  ) {
    const attachment = await this.getAttachmentDeliveryMetadata(
      ticketId,
      attachmentId,
      currentUser,
    );
    const access = this.createAttachmentAccessUrl(attachment, true);
    const file = await this.cloudinaryService.downloadFile(access.url);

    return {
      file,
      fileName: attachment.fileName,
      contentType: resolveAttachmentContentType(attachment.fileType),
    };
  }

  async deleteAttachment(
    ticketId: number,
    attachmentId: number,
    currentUser: CurrentUserPayload,
  ) {
    await this.access.canAccessTicket(ticketId, currentUser);

    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: {
        id: attachmentId,
        ticketId,
      },
      select: {
        fileName: true,
        fileUrl: true,
        publicId: true,
        resourceType: true,
        deliveryType: true,
        uploadedById: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (currentUser.role === UserRole.MANAGER) {
      throw new ForbiddenException('Forbidden');
    }

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      attachment.uploadedById !== currentUser.userId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.ticketAttachment.deleteMany({
        where: {
          id: attachmentId,
          ticketId,
        },
      });

      if (deleted.count !== 1) {
        throw new NotFoundException('Attachment not found');
      }

      await transaction.ticketHistory.create({
        data: {
          ticketId,
          userId: currentUser.userId,
          action: TicketHistoryAction.ATTACHMENT_DELETED,
          newValue: attachment.fileName,
        },
      });

      if (attachment.publicId) {
        await this.outboxService.enqueue(transaction, {
          type: OUTBOX_EVENT_TYPES.CLOUDINARY_ASSET_DELETE,
          payload: {
            publicId: attachment.publicId,
            resourceType: resolveCloudinaryResourceType(
              attachment.resourceType,
              attachment.fileUrl,
            ),
            deliveryType: resolveCloudinaryDeliveryType(
              attachment.deliveryType,
            ),
          },
          deduplicationKey: `cloudinary-delete:ticket:${ticketId}:attachment:${attachmentId}`,
        });
      }
    });

    return { id: attachmentId };
  }
}
