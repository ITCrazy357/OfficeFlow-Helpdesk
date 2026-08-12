import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TicketPriority, TicketStatus } from '@prisma/client';

export enum TicketSlaFilter {
  ON_TRACK = 'ON_TRACK',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
}

export class GetTicketsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Current page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'vpn',
    description: 'Search keyword for ticket title or description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({
    enum: TicketStatus,
    example: TicketStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter overdue tickets',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;

    return value;
  })
  @IsBoolean()
  isOverdue?: boolean;

  @ApiPropertyOptional({
    enum: TicketSlaFilter,
    example: TicketSlaFilter.DUE_SOON,
    description:
      'Filter active tickets by SLA state. DUE_SOON means due within 24 hours.',
  })
  @IsOptional()
  @IsEnum(TicketSlaFilter)
  slaState?: TicketSlaFilter;
}
