import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';

import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Message('Get notifications successfully')
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'isRead', required: false, example: false })
  @ApiResponse({ status: 200, description: 'Get notifications successfully' })
  findMine(
    @CurrentUser('userId') userId: number,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.findMine(userId, query);
  }

  @Get('unread-count')
  @Message('Get unread notification count successfully')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser('userId') userId: number) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @Message('Mark notification as read successfully')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', example: 1 })
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @Message('Mark all notifications as read successfully')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser('userId') userId: number) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @Message('Delete notification successfully')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'id', example: 1 })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.notificationsService.remove(id, userId);
  }
}
