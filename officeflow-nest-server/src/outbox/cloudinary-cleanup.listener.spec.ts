import type { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CloudinaryCleanupListener } from './cloudinary-cleanup.listener';

const mockCloudinaryService = {
  deleteFile: jest.fn(),
};

describe('CloudinaryCleanupListener', () => {
  const listener = new CloudinaryCleanupListener(
    mockCloudinaryService as unknown as CloudinaryService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockCloudinaryService.deleteFile.mockResolvedValue(undefined);
  });

  it('deletes the exact Cloudinary asset described by the event', async () => {
    await listener.handle({
      publicId: 'officeflow/tickets/42/file.pdf',
      resourceType: 'raw',
      deliveryType: 'private',
    });

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'officeflow/tickets/42/file.pdf',
      'raw',
      'private',
    );
  });

  it('rejects an invalid payload before calling Cloudinary', async () => {
    await expect(
      listener.handle({
        publicId: '',
        resourceType: 'raw',
        deliveryType: 'private',
      }),
    ).rejects.toThrow('Cloudinary cleanup event payload is invalid');

    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
  });
});
