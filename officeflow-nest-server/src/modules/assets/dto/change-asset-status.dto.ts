import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

const MANUAL_ASSET_STATUSES = [
  AssetStatus.AVAILABLE,
  AssetStatus.MAINTENANCE,
  AssetStatus.RETIRED,
  AssetStatus.LOST,
] as const;

export class ChangeAssetStatusDto {
  @ApiProperty({
    enum: MANUAL_ASSET_STATUSES,
    example: AssetStatus.MAINTENANCE,
  })
  @IsIn(MANUAL_ASSET_STATUSES)
  status!: AssetStatus;
}
