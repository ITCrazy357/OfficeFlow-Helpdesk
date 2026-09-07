import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  CloudinaryService,
  type CloudinaryDeliveryType,
  type CloudinaryResourceType,
} from '../cloudinary/cloudinary.service';
import { OUTBOX_EVENT_TYPES } from './outbox.constants';

type CloudinaryAssetDeleteEvent = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  deliveryType: CloudinaryDeliveryType;
};

function isResourceType(value: string): value is CloudinaryResourceType {
  return value === 'image' || value === 'raw' || value === 'video';
}

function isDeliveryType(value: string): value is CloudinaryDeliveryType {
  return value === 'upload' || value === 'private' || value === 'authenticated';
}

@Injectable()
export class CloudinaryCleanupListener {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @OnEvent(OUTBOX_EVENT_TYPES.CLOUDINARY_ASSET_DELETE, {
    suppressErrors: false,
  })
  async handle(event: CloudinaryAssetDeleteEvent): Promise<void> {
    if (
      !event.publicId ||
      !isResourceType(event.resourceType) ||
      !isDeliveryType(event.deliveryType)
    ) {
      throw new Error('Cloudinary cleanup event payload is invalid');
    }

    await this.cloudinaryService.deleteFile(
      event.publicId,
      event.resourceType,
      event.deliveryType,
    );
  }
}
