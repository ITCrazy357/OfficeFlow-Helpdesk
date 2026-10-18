import { AiRequestLimiter } from './ai-request-limiter';
import { RedisService } from '../redis/redis.service';

describe('AiRequestLimiter', () => {
  const client = {
    set: jest.fn<
      Promise<string | null>,
      [string, string, { NX: boolean; PX: number }]
    >(),
    eval: jest.fn<
      Promise<number>,
      [string, { keys: string[]; arguments: string[] }]
    >(),
  };
  const redis = {
    isReady: jest.fn(),
    getClient: () => client,
    key: (...parts: Array<string | number>) => parts.join(':'),
  };
  let limiter: AiRequestLimiter;
  beforeEach(() => {
    jest.clearAllMocks();
    limiter = new AiRequestLimiter(redis as unknown as RedisService);
    redis.isReady.mockReturnValue(true);
    client.set.mockResolvedValue('OK');
    client.eval.mockResolvedValue(1);
  });
  it('fails closed when Redis is unavailable', async () => {
    redis.isReady.mockReturnValue(false);
    const work = jest.fn();
    await expect(limiter.run(1, work)).rejects.toMatchObject({ status: 503 });
    expect(work).not.toHaveBeenCalled();
  });
  it('uses a distributed lease, counts attempts and releases only its token', async () => {
    await expect(limiter.run(1, () => Promise.resolve('draft'))).resolves.toBe(
      'draft',
    );
    expect(client.set).toHaveBeenCalledWith('ai:lease:1', expect.any(String), {
      NX: true,
      PX: 120000,
    });
    expect(client.eval.mock.calls[0][0]).toContain('PEXPIRE');
    const token = client.set.mock.calls[0][1];
    expect(client.eval.mock.calls[1][0]).toContain(
      "redis.call('GET', KEYS[1]) == ARGV[1]",
    );
    expect(client.eval.mock.calls[1][1]).toEqual({
      keys: ['ai:lease:1'],
      arguments: [token],
    });
  });
  it('denies a lease owned by another process', async () => {
    client.set.mockResolvedValue(null);
    await expect(
      limiter.run(1, () => Promise.resolve('unused')),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(client.eval).not.toHaveBeenCalled();
  });
  it('rejects a sixth attempt without calling paid work', async () => {
    client.eval.mockResolvedValueOnce(6);
    const work = jest.fn();
    await expect(limiter.run(1, work)).rejects.toMatchObject({ status: 429 });
    expect(work).not.toHaveBeenCalled();
    expect(client.eval).toHaveBeenCalledTimes(2);
  });
  it('propagates work errors and frees local and shared capacity', async () => {
    await expect(
      limiter.run(1, () => Promise.reject(new Error('upstream'))),
    ).rejects.toThrow('upstream');
    await expect(limiter.run(1, () => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
    expect(client.eval).toHaveBeenCalledTimes(4);
  });
  it('enforces one active request per user and four per process', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const running = [1, 2, 3, 4].map((id) => limiter.run(id, () => pending));
    await expect(limiter.run(1, () => pending)).rejects.toMatchObject({
      status: 409,
    });
    await expect(limiter.run(5, () => pending)).rejects.toMatchObject({
      status: 503,
    });
    finish();
    await Promise.all(running);
    await expect(limiter.run(5, () => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
  });
  it('returns a safe failure on Redis errors and frees capacity', async () => {
    client.eval.mockRejectedValueOnce(new Error('private Redis URL'));
    await expect(
      limiter.run(1, () => Promise.resolve('unused')),
    ).rejects.toThrow('không kiểm tra được');
    await expect(limiter.run(1, () => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
  });
});
