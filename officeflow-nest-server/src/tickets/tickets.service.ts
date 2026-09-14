import { Injectable } from '@nestjs/common';
import { TicketQueryService } from './ticket-query.service';
import { TicketWorkflowService } from './ticket-workflow.service';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketCommentService } from './ticket-comment.service';
export type { TicketAttachmentFile } from './ticket-attachment.service';

/** Stable controller-facing facade. Business logic lives in the feature services. */
@Injectable()
export class TicketsService {
  constructor(
    private readonly query: TicketQueryService,
    private readonly workflow: TicketWorkflowService,
    private readonly attachment: TicketAttachmentService,
    private readonly comment: TicketCommentService,
  ) {}
  getTickets(...args: Parameters<TicketQueryService['getTickets']>) {
    return this.query.getTickets(...args);
  }

  canGetById(...args: Parameters<TicketQueryService['canGetById']>) {
    return this.query.canGetById(...args);
  }

  getHistory(...args: Parameters<TicketQueryService['getHistory']>) {
    return this.query.getHistory(...args);
  }

  create(...args: Parameters<TicketWorkflowService['create']>) {
    return this.workflow.create(...args);
  }

  update(...args: Parameters<TicketWorkflowService['update']>) {
    return this.workflow.update(...args);
  }

  updateStatus(...args: Parameters<TicketWorkflowService['updateStatus']>) {
    return this.workflow.updateStatus(...args);
  }

  assign(...args: Parameters<TicketWorkflowService['assign']>) {
    return this.workflow.assign(...args);
  }

  remove(...args: Parameters<TicketWorkflowService['remove']>) {
    return this.workflow.remove(...args);
  }

  linkAsset(...args: Parameters<TicketWorkflowService['linkAsset']>) {
    return this.workflow.linkAsset(...args);
  }

  unlinkAsset(...args: Parameters<TicketWorkflowService['unlinkAsset']>) {
    return this.workflow.unlinkAsset(...args);
  }

  addComment(...args: Parameters<TicketCommentService['addComment']>) {
    return this.comment.addComment(...args);
  }

  getComments(...args: Parameters<TicketCommentService['getComments']>) {
    return this.comment.getComments(...args);
  }

  uploadAttachment(
    ...args: Parameters<TicketAttachmentService['uploadAttachment']>
  ) {
    return this.attachment.uploadAttachment(...args);
  }

  getAttachments(
    ...args: Parameters<TicketAttachmentService['getAttachments']>
  ) {
    return this.attachment.getAttachments(...args);
  }

  getAttachmentAccessUrl(
    ...args: Parameters<TicketAttachmentService['getAttachmentAccessUrl']>
  ) {
    return this.attachment.getAttachmentAccessUrl(...args);
  }

  downloadAttachment(
    ...args: Parameters<TicketAttachmentService['downloadAttachment']>
  ) {
    return this.attachment.downloadAttachment(...args);
  }

  deleteAttachment(
    ...args: Parameters<TicketAttachmentService['deleteAttachment']>
  ) {
    return this.attachment.deleteAttachment(...args);
  }
}
