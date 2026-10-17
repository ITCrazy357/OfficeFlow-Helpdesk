import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import {
  ConfirmTicketDto,
  RateTicketDto,
  ReopenTicketDto,
} from './dto/ticket-feedback.dto';
import { TicketFeedbackService } from './ticket-feedback.service';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/:id')
export class TicketFeedbackController {
  constructor(private readonly feedback: TicketFeedbackService) {}

  @Get('feedback')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.feedback.get(id, actor);
  }

  @Post('confirm')
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmTicketDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.feedback.confirm(id, dto, actor);
  }

  @Post('reopen')
  reopen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenTicketDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.feedback.reopen(id, dto, actor);
  }

  @Post('feedback')
  rate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RateTicketDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.feedback.rate(id, dto, actor);
  }
}
