import { Module } from '@nestjs/common';
import { AccountService } from './accounts.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [UsersController],
  providers: [AccountService, UsersService, RolesGuard],
})
export class UsersModule {}
