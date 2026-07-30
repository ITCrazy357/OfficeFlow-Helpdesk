import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

import { AssignAssetDto } from './dto/assign-asset.dto';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { GetAssetsQueryDto } from './dto/get-assets-query.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Create asset successfully')
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created' })
  create(
    @Body() createAssetDto: CreateAssetDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.create(createAssetDto, currentUser);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Get assets successfully')
  @ApiOperation({ summary: 'Get and filter assets' })
  findAll(@Query() query: GetAssetsQueryDto) {
    return this.assetsService.findAll(query);
  }

  // Static routes must be declared before the parameterized :id route.
  @Get('my')
  @Message('Get my assets successfully')
  @ApiOperation({ summary: 'Get assets assigned to current user' })
  findMine(@CurrentUser('userId') userId: number) {
    return this.assetsService.findMine(userId);
  }

  @Get(':id')
  @Message('Get asset successfully')
  @ApiOperation({ summary: 'Get asset details' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Update asset successfully')
  @ApiOperation({ summary: 'Update asset information' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetDto: UpdateAssetDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.update(id, updateAssetDto, currentUser);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Assign asset successfully')
  @ApiOperation({ summary: 'Assign asset to a user' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignAssetDto: AssignAssetDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.assign(id, assignAssetDto, currentUser);
  }

  @Patch(':id/return')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Return asset successfully')
  @ApiOperation({ summary: 'Return an assigned asset' })
  returnAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() returnAssetDto: ReturnAssetDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.returnAsset(id, returnAssetDto, currentUser);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Change asset status successfully')
  @ApiOperation({ summary: 'Change asset operational status' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() changeAssetStatusDto: ChangeAssetStatusDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.assetsService.changeStatus(
      id,
      changeAssetStatusDto,
      currentUser,
    );
  }

  @Get(':id/assignment-history')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Get asset assignment history successfully')
  @ApiOperation({ summary: 'Get asset assignment history' })
  getAssignmentHistory(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.getAssignmentHistory(id);
  }
}
