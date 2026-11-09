import { PartialType } from '@nestjs/swagger';
import { AssetMaintenanceKind, AssetMaintenanceStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMaintenanceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @IsEnum(AssetMaintenanceKind)
  kind!: AssetMaintenanceKind;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  scheduledFor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class MaintenanceVersionDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto, {
  skipNullProperties: false,
}) {
  @IsInt()
  @Min(0)
  version!: number;
}

export class CompleteMaintenanceDto extends MaintenanceVersionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  performedOn!: string;

  // VND integer string; keep Decimal serialization and avoid float rounding.
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d{0,11})$/)
  cost?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class MaintenanceQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(AssetMaintenanceStatus)
  status?: AssetMaintenanceStatus;
}
