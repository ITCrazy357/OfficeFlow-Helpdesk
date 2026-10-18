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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { GenerateAiDraftDto } from './dto/generate-ai-draft.dto';
import { AiService } from './ai.service';

@ApiTags('AI Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.IT_STAFF)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status(@CurrentUser() actor: CurrentUserPayload) {
    return this.ai.status(actor);
  }

  @Post('tickets/:id/draft')
  generate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateAiDraftDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.ai.generate(id, dto.task, actor);
  }
}
