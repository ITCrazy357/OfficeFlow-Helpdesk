import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus, AssetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetAssetsQueryDto {
  @ApiPropertyOptional({ enum: ['EXPIRING', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['EXPIRING', 'EXPIRED'])
  warranty?: 'EXPIRING' | 'EXPIRED';
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: AssetType,
  })
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @ApiPropertyOptional({
    enum: AssetStatus,
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional({
    example: 2,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  assignedToId?: number;

  @ApiPropertyOptional({
    example: 'Dell',
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
