import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RedisModule } from '../redis/redis.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiController } from './ai.controller';
import { AiProvider } from './ai.provider';
import { AiRequestLimiter } from './ai-request-limiter';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule, KnowledgeModule, RedisModule],
  controllers: [AiController],
  providers: [AiService, AiProvider, AiRequestLimiter, RolesGuard],
})
export class AiModule {}
