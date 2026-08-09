import { PrismaService } from '../prisma/prisma.service';
import {
  REFRESH_TOKEN_CLEANUP_BATCH_SIZE,
  REFRESH_TOKEN_CLEANUP_RETENTION_MS,
  RefreshTokenCleanupService,
} from './refresh-token-cleanup.service';

const mockPrismaService = {
  refreshToken: {
    findMany: jest.fn<Promise<Array<{ id: string }>>, [unknown]>(),
    deleteMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
  },
};

describe('RefreshTokenCleanupService', () => {
  let service: RefreshTokenCleanupService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T12:00:00.000Z'));

    service = new RefreshTokenCleanupService(
      mockPrismaService as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when no refresh tokens are past the retention window', async () => {
    mockPrismaService.refreshToken.findMany.mockResolvedValue([]);

    await expect(service.cleanupExpiredRefreshTokens()).resolves.toBe(0);
    expect(mockPrismaService.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes expired refresh tokens in bounded batches', async () => {
    const firstBatch = Array.from(
      { length: REFRESH_TOKEN_CLEANUP_BATCH_SIZE },
      (_, index) => ({ id: `expired-${index}` }),
    );
    const secondBatch = [{ id: 'expired-last' }];

    mockPrismaService.refreshToken.findMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);
    mockPrismaService.refreshToken.deleteMany
      .mockResolvedValueOnce({ count: firstBatch.length })
      .mockResolvedValueOnce({ count: secondBatch.length });

    await expect(service.cleanupExpiredRefreshTokens()).resolves.toBe(
      firstBatch.length + secondBatch.length,
    );

    const cutoff = new Date(Date.now() - REFRESH_TOKEN_CLEANUP_RETENTION_MS);

    expect(mockPrismaService.refreshToken.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        expiresAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: REFRESH_TOKEN_CLEANUP_BATCH_SIZE,
    });
    expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('stops safely when another worker already deleted the selected rows', async () => {
    mockPrismaService.refreshToken.findMany.mockResolvedValue(
      Array.from({ length: REFRESH_TOKEN_CLEANUP_BATCH_SIZE }, (_, index) => ({
        id: `expired-${index}`,
      })),
    );
    mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.cleanupExpiredRefreshTokens()).resolves.toBe(0);
    expect(mockPrismaService.refreshToken.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
  });
});
