import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type CloudinaryResourceType = 'image' | 'raw' | 'video';

export type CloudinaryDeliveryType = 'upload' | 'private' | 'authenticated';

export type CloudinaryUploadResult = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  deliveryType: CloudinaryDeliveryType;
  format: string;
  secureUrl: string;
};

export type CloudinaryPrivateDownloadResult = {
  url: string;
  expiresAt: Date;
};

const MAX_CLOUDINARY_DOWNLOAD_SIZE_IN_BYTES = 10 * 1024 * 1024;
const CLOUDINARY_DOWNLOAD_TIMEOUT_IN_MS = 60_000;

type CloudinaryDestroyResponse = {
  result: string;
};

function isResourceType(value: string): value is CloudinaryResourceType {
  return value === 'image' || value === 'raw' || value === 'video';
}

function isDeliveryType(value: string): value is CloudinaryDeliveryType {
  return value === 'upload' || value === 'private' || value === 'authenticated';
}

function isDestroyResponse(value: unknown): value is CloudinaryDestroyResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof value.result === 'string'
  );
}

function isTrustedCloudinaryUrl(value: string): boolean {
  try {
    const { hostname, protocol } = new URL(value);
    const normalizedHostname = hostname.toLowerCase();

    return (
      protocol === 'https:' &&
      (normalizedHostname === 'api.cloudinary.com' ||
        normalizedHostname === 'api-eu.cloudinary.com' ||
        normalizedHostname === 'api-ap.cloudinary.com' ||
        normalizedHostname === 'res.cloudinary.com' ||
        normalizedHostname.endsWith('-res.cloudinary.com'))
    );
  } catch {
    return false;
  }
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<CloudinaryUploadResult> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          type: 'authenticated',
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException('Upload file failed'),
            );
          }

          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });

    if (!isResourceType(result.resource_type)) {
      throw new InternalServerErrorException(
        'Cloudinary returned an invalid resource type',
      );
    }

    if (!isDeliveryType(result.type) || !result.format) {
      throw new InternalServerErrorException(
        'Cloudinary returned invalid delivery metadata',
      );
    }

    return {
      publicId: result.public_id,
      resourceType: result.resource_type,
      deliveryType: result.type,
      format: result.format,
      secureUrl: result.secure_url,
    };
  }

  async deleteFile(
    publicId: string,
    resourceType: CloudinaryResourceType,
    deliveryType: CloudinaryDeliveryType = 'upload',
  ): Promise<void> {
    let response: unknown;

    try {
      response = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: deliveryType,
        invalidate: true,
      });
    } catch {
      throw new InternalServerErrorException('Delete file failed');
    }

    if (
      !isDestroyResponse(response) ||
      (response.result !== 'ok' && response.result !== 'not found')
    ) {
      throw new InternalServerErrorException('Delete file failed');
    }
  }

  createPrivateDownloadUrl(
    publicId: string,
    format: string,
    resourceType: CloudinaryResourceType,
    deliveryType: CloudinaryDeliveryType = 'authenticated',
    asAttachment = true,
  ): CloudinaryPrivateDownloadResult {
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;

    const url = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: deliveryType,
      expires_at: expiresAt,
      attachment: asAttachment,
    });

    return {
      url,
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  async downloadFile(url: string): Promise<Buffer> {
    if (!isTrustedCloudinaryUrl(url)) {
      throw new InternalServerErrorException('Download file failed');
    }

    let response: Response;

    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(CLOUDINARY_DOWNLOAD_TIMEOUT_IN_MS),
      });
    } catch {
      throw new InternalServerErrorException('Download file failed');
    }

    if (!response.ok) {
      throw new InternalServerErrorException('Download file failed');
    }

    const declaredSize = Number(response.headers.get('content-length'));

    if (
      Number.isFinite(declaredSize) &&
      declaredSize > MAX_CLOUDINARY_DOWNLOAD_SIZE_IN_BYTES
    ) {
      throw new InternalServerErrorException('Download file failed');
    }

    let file: Buffer;

    try {
      file = Buffer.from(await response.arrayBuffer());
    } catch {
      throw new InternalServerErrorException('Download file failed');
    }

    if (file.byteLength > MAX_CLOUDINARY_DOWNLOAD_SIZE_IN_BYTES) {
      throw new InternalServerErrorException('Download file failed');
    }

    return file;
  }
}
