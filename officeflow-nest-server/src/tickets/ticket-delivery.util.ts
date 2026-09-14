import { InternalServerErrorException } from '@nestjs/common';
import type {
  CloudinaryDeliveryType,
  CloudinaryResourceType,
} from '../cloudinary/cloudinary.service';
import { ALLOWED_ATTACHMENT_FILE_TYPES } from './ticket-attachment.util';
export function resolveCloudinaryResourceType(
  resourceType: string | null,
  fileUrl: string,
): CloudinaryResourceType {
  if (
    resourceType === 'image' ||
    resourceType === 'raw' ||
    resourceType === 'video'
  ) {
    return resourceType;
  }

  const resourceTypeFromUrl = fileUrl.match(
    /\/(image|raw|video)\/upload(?:\/|$)/,
  )?.[1];

  if (
    resourceTypeFromUrl === 'image' ||
    resourceTypeFromUrl === 'raw' ||
    resourceTypeFromUrl === 'video'
  ) {
    return resourceTypeFromUrl;
  }

  return 'image';
}

export function resolveCloudinaryDeliveryType(
  deliveryType: string | null,
): CloudinaryDeliveryType {
  if (
    deliveryType === 'upload' ||
    deliveryType === 'private' ||
    deliveryType === 'authenticated'
  ) {
    return deliveryType;
  }

  if (deliveryType === null) {
    return 'upload';
  }

  throw new InternalServerErrorException(
    'Attachment delivery metadata is invalid',
  );
}

export function resolveAttachmentContentType(fileType: string | null): string {
  return fileType && ALLOWED_ATTACHMENT_FILE_TYPES.test(fileType)
    ? fileType
    : 'application/octet-stream';
}
