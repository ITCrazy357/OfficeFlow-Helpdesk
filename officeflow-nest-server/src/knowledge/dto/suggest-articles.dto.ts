import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuggestArticlesDto {
  @ApiProperty({
    example: 'Cannot connect to VPN',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({
    example: 'VPN client keeps timeout when connecting to company network.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
