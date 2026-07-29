import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Message } from '../common/decorators/message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';
import { TicketCategoriesService } from './ticket-categories.service';

@ApiTags('Ticket Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket-categories')
export class TicketCategoriesController {
  constructor(
    private readonly ticketCategoriesService: TicketCategoriesService,
  ) {}

  @Get()
  @Message('Get ticket categories successfully')
  @ApiOperation({ summary: 'Get all ticket categories' })
  findAll() {
    return this.ticketCategoriesService.findAll();
  }

  @Get(':id')
  @Message('Get ticket category successfully')
  @ApiOperation({ summary: 'Get ticket category detail' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ticketCategoriesService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @Message('Create ticket category successfully')
  @ApiOperation({ summary: 'Create a ticket category' })
  @ApiBody({ type: CreateTicketCategoryDto })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN can create ticket categories',
  })
  create(@Body() createDto: CreateTicketCategoryDto) {
    return this.ticketCategoriesService.create(createDto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @Message('Update ticket category successfully')
  @ApiOperation({ summary: 'Update a ticket category' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateTicketCategoryDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTicketCategoryDto,
  ) {
    return this.ticketCategoriesService.update(id, updateDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @Message('Delete ticket category successfully')
  @ApiOperation({
    summary: 'Delete a ticket category and unlink its existing tickets',
  })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ticketCategoriesService.remove(id);
  }
}
