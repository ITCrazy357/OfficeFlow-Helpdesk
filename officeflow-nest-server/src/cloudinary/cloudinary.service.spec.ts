import { InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Writable } from 'stream';

import { CloudinaryService } from './cloudinary.service';

type UploadResponseCallback = (
  error?: unknown,
  result?: UploadApiResponse,
) => void;

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
    utils: {
      private_download_url: jest.fn(),
    },
  },
}));

const uploadResponse = {
  public_id: 'officeflow/ticket-attachments/report',
  resource_type: 'raw',
  type: 'authenticated',
  format: 'pdf',
  secure_url: 'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
} as UploadApiResponse;

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudinaryService();
  });

  function mockSuccessfulUpload(response: UploadApiResponse): void {
    jest
      .mocked(cloudinary.uploader.upload_stream)
      .mockImplementation((_options, callback) => {
        const uploadCallback = callback as UploadResponseCallback | undefined;
        const stream = new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
        });

        stream.on('finish', () => {
          uploadCallback?.(undefined, response);
        });

        return stream as unknown as ReturnType<
          typeof cloudinary.uploader.upload_stream
        >;
      });
  }

  it('returns the Cloudinary delivery metadata for an authenticated upload', async () => {
    mockSuccessfulUpload(uploadResponse);

    await expect(
      service.uploadFile(
        { buffer: Buffer.from('%PDF-1.7') } as Express.Multer.File,
        'officeflow/ticket-attachments',
      ),
    ).resolves.toEqual({
      publicId: 'officeflow/ticket-attachments/report',
      resourceType: 'raw',
      deliveryType: 'authenticated',
      format: 'pdf',
      secureUrl: 'https://res.cloudinary.com/demo/raw/authenticated/report.pdf',
    });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'officeflow/ticket-attachments',
        resource_type: 'auto',
        type: 'authenticated',
      }),
      expect.any(Function),
    );
  });

  it('rejects an upload response with invalid delivery metadata', async () => {
    mockSuccessfulUpload({
      ...uploadResponse,
      type: 'unexpected',
    });

    await expect(
      service.uploadFile(
        { buffer: Buffer.from('%PDF-1.7') } as Express.Multer.File,
        'officeflow/ticket-attachments',
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('deletes an asset using its resource and delivery types', async () => {
    jest
      .mocked(cloudinary.uploader.destroy)
      .mockResolvedValue({ result: 'ok' });

    await service.deleteFile(
      'officeflow/ticket-attachments/report',
      'raw',
      'authenticated',
    );

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report',
      {
        resource_type: 'raw',
        type: 'authenticated',
        invalidate: true,
      },
    );
  });

  it('returns the correct expiration date for a private download URL', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    jest
      .mocked(cloudinary.utils.private_download_url)
      .mockReturnValue('https://api.cloudinary.com/private-download');

    expect(
      service.createPrivateDownloadUrl(
        'officeflow/ticket-attachments/report',
        'pdf',
        'raw',
        'authenticated',
      ),
    ).toEqual({
      url: 'https://api.cloudinary.com/private-download',
      expiresAt: new Date(1_800_000_300_000),
    });
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      'officeflow/ticket-attachments/report',
      'pdf',
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: 1_800_000_300,
        attachment: true,
      },
    );
  });
});
