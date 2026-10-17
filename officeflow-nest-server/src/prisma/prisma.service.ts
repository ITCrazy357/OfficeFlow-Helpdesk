import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { getDatabaseAdapterConfig } from './database.config';
import { assertDatabaseSchemaReady } from './schema-readiness';
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
        getDatabaseAdapterConfig(
          config.getOrThrow<string>('DATABASE_URL'),
          config.get<string>('DATABASE_SSL_CA_PATH'),
        ),
      ),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      await this.assertReady();
    } catch (error) {
      await this.$disconnect().catch(() => undefined);
      throw error;
    }
  }

  async assertReady(): Promise<void> {
    // A connection alone does not prove that this release's schema is present.
    await this.$queryRaw`SELECT 1`;
    await assertDatabaseSchemaReady(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
