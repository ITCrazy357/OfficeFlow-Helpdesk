import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class AssignTicketDto {
  @ApiProperty({
    example: 1,
    description: 'Assigned user ID',
  })
  @IsInt()
  assignedToId!: number;
}
