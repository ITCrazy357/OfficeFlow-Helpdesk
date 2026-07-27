import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({
    example: 'LAP-0001',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'assetTag may only contain letters, numbers, - and _',
  })
  assetTag!: string;

  @ApiProperty({
    example: 'Dell Latitude 5440',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    enum: AssetType,
    example: AssetType.LAPTOP,
  })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiPropertyOptional({
    example: 'Dell',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({
    example: 'Latitude 5440',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({
    example: 'SN-DELL-00001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional({
    example: '2026-01-10',
  })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({
    example: '2029-01-10',
  })
  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @ApiPropertyOptional({
    example: 'Purchased for Finance department.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
