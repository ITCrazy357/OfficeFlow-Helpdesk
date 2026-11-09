import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectLeaveRequestDto {
  @ApiProperty({
    example: 'Insufficient staffing during the requested period.',
    description: 'Reason shown to the requester when the leave is rejected',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reviewNote!: string;
}
