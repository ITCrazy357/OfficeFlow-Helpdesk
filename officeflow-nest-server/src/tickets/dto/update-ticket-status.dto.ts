import { IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTicketStatusDto {
  @ApiProperty({
    enum: TicketStatus,
    example: TicketStatus.CLOSED,
    description: 'Ticket status',
  })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
