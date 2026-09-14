import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { getDatabaseUrl } from './database.config';
import { assertOutboxSchemaReady } from './schema-readiness';
import { ConfigService } from '@nestjs/config';

@Injectable()
//Được đánh dấu là Injectable để có thể được sử dụng trong các lớp khác trong NestJS.
//Được quản lý bởi hệ thống Dependency Injection của NestJS.
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaMariaDb(
        getDatabaseUrl(config.getOrThrow<string>('DATABASE_URL')),
      ),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      // The adapter may swallow its initial capability-query error. Require an
      // actual query to succeed before Nest reports the application as ready.
      await this.$queryRaw`SELECT 1`;
      await assertOutboxSchemaReady(this);
    } catch (error) {
      await this.$disconnect().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
