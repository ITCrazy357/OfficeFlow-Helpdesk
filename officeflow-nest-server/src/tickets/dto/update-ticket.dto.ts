import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    example: 'Cannot connect to VPN',
    description: 'Ticket title',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    example: 'I cannot connect to company VPN from my laptop.',
    description: 'Detailed ticket description',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @ApiPropertyOptional({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
    description: 'Ticket priority',
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    example: 3,
    description: 'Ticket category ID',
  })
  @IsOptional()
  @IsInt()
  categoryId?: number;
}
