import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, TicketPriority, TicketStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { GetTicketsQueryDto } from './dto/get-tickets-query.dto';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get tickets with pagination, search and filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'keyword', required: false, example: 'vpn' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiQuery({ name: 'priority', required: false, enum: TicketPriority })
  @ApiQuery({ name: 'categoryId', required: false, example: 3 })
  @ApiResponse({ status: 200, description: 'Get tickets successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTickets(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: GetTicketsQueryDto,
  ) {
    return this.ticketsService.getTickets(currentUser, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 201, description: 'Create ticket successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.create(createTicketDto, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail by ID' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Get ticket detail successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  getById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.getById(id, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket information' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Update ticket successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketDto: UpdateTicketDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.update(id, updateTicketDto, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateTicketStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Update ticket status successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or IT_STAFF can update status',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.updateStatus(
      id,
      updateTicketStatusDto,
      currentUser,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign ticket to IT staff or admin' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: AssignTicketDto })
  @ApiResponse({ status: 200, description: 'Assign ticket successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or IT_STAFF can assign ticket',
  })
  @ApiResponse({ status: 404, description: 'Ticket or assignee not found' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignTicketDto: AssignTicketDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.assign(id, assignTicketDto, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Delete ticket successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.remove(id, currentUser);
  }
}
