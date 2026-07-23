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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';

import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';
import { GetKnowledgeQueryDto } from './dto/get-knowledge-query.dto';
import { SuggestArticlesDto } from './dto/suggest-articles.dto';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @Message('Get knowledge articles successfully')
  @ApiOperation({
    summary: 'Get knowledge articles with search and pagination',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'keyword', required: false, example: 'vpn' })
  @ApiQuery({ name: 'tag', required: false, example: 'network' })
  @ApiQuery({ name: 'isPublished', required: false, example: true })
  @ApiResponse({
    status: 200,
    description: 'Get knowledge articles successfully',
  })
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: GetKnowledgeQueryDto,
  ) {
    return this.knowledgeService.findAll(currentUser, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Post()
  @Message('Create knowledge article successfully')
  @ApiOperation({ summary: 'Create a knowledge article' })
  @ApiBody({ type: CreateKnowledgeArticleDto })
  @ApiResponse({
    status: 201,
    description: 'Create knowledge article successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or IT_STAFF can create article',
  })
  create(
    @Body() createDto: CreateKnowledgeArticleDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.create(createDto, currentUser);
  }

  @Post('suggest-for-ticket')
  @Message('Suggest knowledge articles successfully')
  @ApiOperation({
    summary: 'Suggest articles based on ticket title and description',
  })
  @ApiBody({ type: SuggestArticlesDto })
  suggestForTicket(
    @Body() suggestDto: SuggestArticlesDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.suggestForTicket(suggestDto, currentUser);
  }

  @Get(':id')
  @Message('Get knowledge article successfully')
  @ApiOperation({ summary: 'Get knowledge article detail' })
  @ApiParam({ name: 'id', example: 1 })
  getById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.getById(id, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id')
  @Message('Update knowledge article successfully')
  @ApiOperation({ summary: 'Update knowledge article' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateKnowledgeArticleDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateKnowledgeArticleDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.update(id, updateDto, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Patch(':id/publish')
  @Message('Publish knowledge article successfully')
  @ApiOperation({ summary: 'Publish knowledge article' })
  @ApiParam({ name: 'id', example: 1 })
  publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.publish(id, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Delete(':id')
  @Message('Delete knowledge article successfully')
  @ApiOperation({ summary: 'Delete knowledge article' })
  @ApiParam({ name: 'id', example: 1 })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.knowledgeService.remove(id, currentUser);
  }
}
