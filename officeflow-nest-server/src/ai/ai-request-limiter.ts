import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

const COUNT_REQUEST = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], 60000) end
return count`;
const RELEASE_LEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

@Injectable()
export class AiRequestLimiter {
  private readonly logger = new Logger(AiRequestLimiter.name);
  private readonly activeUsers = new Set<number>();
  constructor(private readonly redis: RedisService) {}

  async run<T>(userId: number, work: () => Promise<T>): Promise<T> {
    if (this.activeUsers.has(userId))
      throw new ConflictException('Bạn đang có một yêu cầu AI chưa hoàn tất.');
    if (this.activeUsers.size >= 4)
      throw new ServiceUnavailableException(
        'AI đang bận. Vui lòng thử lại sau.',
      );
    if (!this.redis.isReady())
      throw new ServiceUnavailableException(
        'AI tạm ngừng vì bộ giới hạn yêu cầu chưa sẵn sàng.',
      );
    this.activeUsers.add(userId);
    const token = randomUUID();
    const key = this.redis.key('ai', 'lease', userId);
    let acquired = false;
    try {
      try {
        const client = this.redis.getClient();
        acquired =
          (await client.set(key, token, { NX: true, PX: 120_000 })) === 'OK';
        if (!acquired)
          throw new ConflictException(
            'Bạn đang có một yêu cầu AI chưa hoàn tất.',
          );
        const count = await client.eval(COUNT_REQUEST, {
          keys: [this.redis.key('ai', 'requests', userId)],
          arguments: [],
        });
        if (typeof count !== 'number' || !Number.isSafeInteger(count))
          throw new Error('Invalid limiter response');
        if (count > 5)
          throw new HttpException(
            'Tối đa 5 yêu cầu AI mỗi phút. Vui lòng thử lại sau.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException(
          'AI tạm ngừng vì không kiểm tra được giới hạn yêu cầu.',
        );
      }
      return await work();
    } finally {
      try {
        if (acquired)
          await this.redis
            .getClient()
            .eval(RELEASE_LEASE, { keys: [key], arguments: [token] });
      } catch {
        this.logger.warn({ event: 'ai_lease_release_failed' });
      }
      this.activeUsers.delete(userId);
    }
  }
}
