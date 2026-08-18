import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaveRequestPaginationQueryDto {
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
}

export class GetLeaveRequestDto extends LeaveRequestPaginationQueryDto {
  @ApiPropertyOptional({
    example: LeaveStatus.PENDING,
    description: 'Leave request status',
  })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
