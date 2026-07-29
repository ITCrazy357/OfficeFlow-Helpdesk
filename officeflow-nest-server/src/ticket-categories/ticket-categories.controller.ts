import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Message } from '../common/decorators/message.decorator';
import { TicketCategoriesService } from './ticket-categories.service';

@ApiTags('Ticket Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ticket-categories')
export class TicketCategoriesController {
  constructor(
    private readonly ticketCategoriesService: TicketCategoriesService,
  ) {}

  @Get()
  @Message('Get ticket categories successfully')
  findAll() {
    return this.ticketCategoriesService.findAll();
  }
}
