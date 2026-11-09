import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class BulkAssignTicketsDto {
  @ApiProperty({ type: [Number], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ticketIds!: number[];

  @ApiProperty({
    description: 'Active IT staff or admin receiving the tickets',
  })
  @IsInt()
  @Min(1)
  assignedToId!: number;
}
