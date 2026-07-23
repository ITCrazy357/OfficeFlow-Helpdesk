import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type CloudinaryResourceType = 'image' | 'raw' | 'video';

export type CloudinaryUploadResult = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  secureUrl: string;
};

type CloudinaryDestroyResponse = {
  result: string;
};

function isResourceType(value: string): value is CloudinaryResourceType {
  return value === 'image' || value === 'raw' || value === 'video';
}

function isDestroyResponse(value: unknown): value is CloudinaryDestroyResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof value.result === 'string'
  );
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
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException('Upload file failed'),
            );
          }

          return resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });

    if (!isResourceType(result.resource_type)) {
      throw new InternalServerErrorException(
        'Cloudinary returned an invalid resource type',
      );
    }

    return {
      publicId: result.public_id,
      resourceType: result.resource_type,
      secureUrl: result.secure_url,
    };
  }

  async deleteFile(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<void> {
    let response: unknown;

    try {
      response = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
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
}
