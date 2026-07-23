import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateKnowledgeArticleDto {
  @ApiProperty({
    example: 'How to reset VPN profile',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({
    example: 'Guide for employees who cannot connect to company VPN.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @ApiProperty({
    example:
      'Step 1: Open VPN client. Step 2: Remove old profile. Step 3: Login again.',
  })
  @IsString()
  @MinLength(20)
  content!: string;

  @ApiPropertyOptional({
    example: 'vpn,network,remote-work',
    description: 'Comma-separated tags',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
