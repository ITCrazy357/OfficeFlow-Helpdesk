import { Logger } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisService } from './redis.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('RedisService', () => {
  const client = {
    on: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    destroy: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    multi: jest.fn(),
    isReady: false,
    isOpen: false,
  };
  const pipeline = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() };
  const originalEnv = { ...process.env };
  let service: RedisService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.REDIS_URL = 'redis://127.0.0.1:16380';
    process.env.REDIS_KEY_PREFIX = 'officeflow:test';
    delete process.env.REDIS_CONNECT_TIMEOUT_MS;
    delete process.env.REDIS_COMMAND_TIMEOUT_MS;
    client.isReady = false;
    client.isOpen = false;
    client.connect.mockResolvedValue(undefined);
    client.quit.mockResolvedValue(undefined);
    client.multi.mockReturnValue(pipeline);
    pipeline.incr.mockReturnValue(pipeline);
    pipeline.expire.mockReturnValue(pipeline);
    pipeline.exec.mockResolvedValue([1, true]);
    jest
      .mocked(createClient)
      .mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    service = new RedisService();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('disables offline queues and configures bounded connection/command waits', () => {
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        disableOfflineQueue: true,
        commandOptions: { timeout: 1500 },
        socket: expect.objectContaining({ connectTimeout: 3000 }) as unknown,
      }),
    );
    expect(service.key('dashboard', 3)).toBe('officeflow:test:dashboard:3');
  });
  it('does not block bootstrap on an initial connection failure', async () => {
    client.connect.mockRejectedValue(new Error('offline'));
    expect(service.onModuleInit()).toBeUndefined();
    await Promise.resolve();
    expect(client.connect).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'closes an open client safely, ready=%s',
    async (ready) => {
      client.isReady = ready;
      client.isOpen = true;
      await service.onModuleDestroy();
      expect(client.quit).toHaveBeenCalledTimes(ready ? 1 : 0);
      expect(client.destroy).toHaveBeenCalledTimes(ready ? 0 : 1);
    },
  );
  it('does not close an already closed client', async () => {
    await service.onModuleDestroy();
    expect(client.quit).not.toHaveBeenCalled();
    expect(client.destroy).not.toHaveBeenCalled();
  });
  it('writes JSON with expiration and reads it back', async () => {
    await service.setJson('key', { count: 2 }, 60);
    expect(client.set).toHaveBeenCalledWith('key', '{"count":2}', { EX: 60 });
    client.get.mockResolvedValue('{"count":2}');
    await expect(service.getJson('key')).resolves.toEqual({ count: 2 });
  });
  it('returns null for a missing cache value', async () => {
    client.get.mockResolvedValue(null);
    await expect(service.getJson('key')).resolves.toBeNull();
    expect(client.del).not.toHaveBeenCalled();
  });
  it('evicts malformed JSON', async () => {
    client.get.mockResolvedValue('{broken');
    await expect(service.getJson('key')).resolves.toBeNull();
    expect(client.del).toHaveBeenCalledWith('key');
  });
  it('propagates command failures so callers can apply fallback', async () => {
    const error = new Error('offline');
    client.get.mockRejectedValue(error);
    await expect(service.getJson('key')).rejects.toBe(error);
  });
  it.each([
    [null, 0],
    ['42', 42],
    ['-1', 0],
    ['broken', 0],
  ])('reads dashboard version %s as %s', async (value, expected) => {
    client.get.mockResolvedValue(value);
    await expect(service.getDashboardVersion()).resolves.toBe(expected);
    expect(client.get).toHaveBeenCalledWith(
      service.key('dashboard', 'version'),
    );
  });
  it('increments the dashboard version and refreshes its TTL atomically', async () => {
    await expect(service.incrementDashboardVersion()).resolves.toBe(1);
    expect(pipeline.incr).toHaveBeenCalledWith(
      service.key('dashboard', 'version'),
    );
    expect(pipeline.expire).toHaveBeenCalledWith(
      service.key('dashboard', 'version'),
      86400,
    );
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
  });
});
