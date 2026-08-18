import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiPropertyOptional({
    example: '2023-01-01',
    description: 'Start date of the leave request in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiPropertyOptional({
    example: '2023-01-10',
    description: 'End date of the leave request in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @ApiPropertyOptional({
    example: 'I need to take a leave of absence for personal reasons.',
    description: 'Reason for the leave request',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}
