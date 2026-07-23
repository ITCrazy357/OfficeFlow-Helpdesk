import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole, TicketPriority, TicketStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

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

import { Message } from '../common/decorators/message.decorator';

import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';

const MAX_ATTACHMENT_SIZE_IN_BYTES = 10 * 1024 * 1024;

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Lấy ticket và các param
  @UseGuards(JwtAuthGuard)
  @Get()
  @Message('Get tickets successfully')
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

  //tạo ticket
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Message('Create ticket successfully')
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

  //Lấy chi tiết ticket
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Get ticket detail successfully')
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
    return this.ticketsService.canGetById(id, currentUser);
  }

  //update ticket
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Update ticket successfully')
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

  //Update status
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Message('Update ticket status successfully')
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

  //Thêm người xử lý vào ticket
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Message('Assign ticket successfully')
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

  //Delete
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Delete ticket successfully')
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

  //Add comment
  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @Message('Add ticket comment successfully')
  @ApiOperation({ summary: 'Add a comment to a ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: CreateTicketCommentDto })
  @ApiResponse({ status: 201, description: 'Add ticket comment successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() createCommentDto: CreateTicketCommentDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.addComment(id, createCommentDto, currentUser);
  }

  //Lấy ticket có comment
  @UseGuards(JwtAuthGuard)
  @Get(':id/comments')
  @HttpCode(HttpStatus.OK)
  @Message('Get ticket comments successfully')
  @ApiOperation({ summary: 'Get comments of a ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Get ticket comments successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getComments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.getComments(id, currentUser);
  }

  //lấy lịch sử theo ticket
  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @Message('Get ticket history successfully')
  @ApiOperation({ summary: 'Get history of a ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Get ticket history successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.getHistory(id, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ATTACHMENT_SIZE_IN_BYTES },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  @Message('Upload ticket attachment successfully')
  @ApiOperation({ summary: 'Upload an attachment to a ticket' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload ticket attachment successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or missing file' })
  @ApiResponse({ status: 413, description: 'Attachment exceeds 10 MB' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_ATTACHMENT_SIZE_IN_BYTES,
            errorMessage: 'Attachment must not exceed 10 MB',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.uploadAttachment(id, file, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/attachments')
  @HttpCode(HttpStatus.OK)
  @Message('Get ticket attachments successfully')
  @ApiOperation({ summary: 'Get attachments of a ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Get ticket attachments successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  getAttachments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.getAttachments(id, currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.OK)
  @Message('Delete ticket attachment successfully')
  @ApiOperation({ summary: 'Delete an attachment from a ticket' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'attachmentId', example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Delete ticket attachment successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 404,
    description: 'Ticket or attachment not found',
  })
  deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.ticketsService.deleteAttachment(id, attachmentId, currentUser);
  }
}
