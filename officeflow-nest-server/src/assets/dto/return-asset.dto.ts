import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnAssetDto {
  @ApiPropertyOptional({
    example: 'Returned in good condition.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
