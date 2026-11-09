import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLogAction, AuditLogEntity } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetAuditLogsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: AuditLogEntity,
    example: AuditLogEntity.ASSET,
  })
  @IsOptional()
  @IsEnum(AuditLogEntity)
  entity?: AuditLogEntity;

  @ApiPropertyOptional({
    enum: AuditLogAction,
    example: AuditLogAction.ASSIGNED,
  })
  @IsOptional()
  @IsEnum(AuditLogAction)
  action?: AuditLogAction;

  @ApiPropertyOptional({
    example: 2,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiPropertyOptional({
    example: 5,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional({
    example: 'asset',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
