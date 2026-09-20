import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardCacheListener } from './listeners/dashboard-cache.listener';

@Module({
  imports: [AuthModule, MetricsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardCacheListener],
})
export class DashboardModule {}
