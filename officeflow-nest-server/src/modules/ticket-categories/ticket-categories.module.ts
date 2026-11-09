import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketCategoriesController } from './ticket-categories.controller';
import { TicketCategoriesService } from './ticket-categories.service';

@Module({
  imports: [AuthModule],
  controllers: [TicketCategoriesController],
  providers: [TicketCategoriesService],
})
export class TicketCategoriesModule {}
