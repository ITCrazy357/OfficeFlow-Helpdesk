import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { getDatabaseUrl } from './database.config';

@Injectable()
//Được đánh dấu là Injectable để có thể được sử dụng trong các lớp khác trong NestJS.
//Được quản lý bởi hệ thống Dependency Injection của NestJS.
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaMariaDb(getDatabaseUrl()),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      // The adapter may swallow its initial capability-query error. Require an
      // actual query to succeed before Nest reports the application as ready.
      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      await this.$disconnect().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
