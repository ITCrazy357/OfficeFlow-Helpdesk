import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
const DEFAULT_CONNECT_TIMEOUT_MS = 3_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 1_500;
const MAX_RECONNECT_DELAY_MS = 3_000;
const DASHBOARD_VERSION_TTL_SECONDS = 24 * 60 * 60;

//Hàm này dùng để đọc số từ .env.
function readPositiveInteger(value: string | undefined, fallback: number) {
  const configured = Number(value);

  return Number.isInteger(configured) && configured > 0 ? configured : fallback;
}

//tạo namespace cho Redis key
function buildKeyPrefix() {
  const configured = process.env.REDIS_KEY_PREFIX?.trim();
  const fallback = `officeflow:${process.env.NODE_ENV ?? 'development'}`;

  return (configured || fallback).replace(/[^a-zA-Z0-9:._-]/g, '_');
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly keyPrefix = buildKeyPrefix();
  private readonly client: RedisClientType;
  private unavailableLogged = false; //chỉ log cảnh báo đầu tiên trong một chuỗi lỗi.

  //Hàm private để gom logic log lỗi Redis.
  private logUnavailable(message: string, error?: unknown) {
    if (this.unavailableLogged) {
      return;
    }

    this.unavailableLogged = true;
    const detail = error instanceof Error ? `: ${error.message}` : '';
    this.logger.warn(`${message}${detail}`);
  }

  constructor() {
    //cấu hình Redis client.
    this.client = createClient({
      url: process.env.REDIS_URL?.trim() || DEFAULT_REDIS_URL,
      disableOfflineQueue: true,
      commandOptions: {
        timeout: readPositiveInteger(
          process.env.REDIS_COMMAND_TIMEOUT_MS,
          DEFAULT_COMMAND_TIMEOUT_MS,
        ),
      },
      socket: {
        connectTimeout: readPositiveInteger(
          process.env.REDIS_CONNECT_TIMEOUT_MS,
          DEFAULT_CONNECT_TIMEOUT_MS,
        ),
        //Đây là exponential backoff. Giảm tải khi redis chết mà application reconnect liên tục
        reconnectStrategy: (retries) =>
          Math.min(200 * 2 ** Math.min(retries, 4), MAX_RECONNECT_DELAY_MS),
      },
    });

    this.client.on('ready', () => {
      this.unavailableLogged = false; //Redis đã hồi phục, lần mất kết nối tiếp theo có thể log warning mới.
      this.logger.log('Redis connection is ready');
    });

    this.client.on('reconnecting', () => {
      this.logUnavailable('Redis connection lost; reconnecting');
    });

    this.client.on('error', (error) => {
      this.logUnavailable('Redis is unavailable', error);
    });
  }

  onModuleInit() {
    // Redis is an optimization and distributed coordination dependency.
    // The API remains available while the client reconnects in the background.
    void this.client.connect().catch((error: unknown) => {
      this.logUnavailable('Redis initial connection failed', error);
    });
  }
  //Khi application shutdown.
  async onModuleDestroy() {
    if (this.client.isReady) {
      await this.client.quit();
    } else if (this.client.isOpen) {
      this.client.destroy();
    }
  }

  isReady() {
    return this.client.isReady;
  }

  key(...parts: Array<string | number>) {
    return [this.keyPrefix, ...parts].join(':');
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.set(key, value, {
        EX: ttlSeconds,
      });

      return;
    }

    await this.client.set(key, value);
  }

  async del(key: string) {
    await this.client.del(key);
  }
  //Gia tăng
  async incr(key: string) {
    return this.client.incr(key);
  }

  //Cho phép code bên ngoài lấy Redis client gốc.
  getClient() {
    return this.client;
  }

  async getDashboardVersion() {
    const key = this.key('dashboard', 'version');
    const value = await this.get(key);

    if (value === null) {
      return 0;
    }

    const version = Number(value);

    if (Number.isSafeInteger(version) && version >= 0) {
      return version;
    }

    this.logger.warn('Discarding an invalid dashboard cache version');
    await this.del(key);
    return 0;
  }
  //Gia tăng version
  async incrementDashboardVersion() {
    const key = this.key('dashboard', 'version');
    const [version] = await this.client
      .multi()
      .incr(key)
      .expire(key, DASHBOARD_VERSION_TTL_SECONDS)
      .exec();

    return version;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      this.logger.warn(`Discarding invalid JSON from Redis key ${key}`);
      await this.del(key);
      return null;
    }
  }

  setJson(key: string, value: unknown, ttlSeconds: number) {
    return this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
