import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { SlaPolicyService } from './sla-policy.service';

@ApiTags('SLA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('sla/policy')
export class SlaController {
  constructor(private readonly policies: SlaPolicyService) {}

  @Get()
  @Message('Get SLA policy successfully')
  get() {
    return this.policies.get();
  }

  @Put()
  @Message('Update SLA policy successfully')
  update(
    @Body() dto: UpdateSlaPolicyDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.policies.update(dto, actor);
  }
}
