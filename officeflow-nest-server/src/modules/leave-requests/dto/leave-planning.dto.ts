import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateBy,
} from 'class-validator';
import { CreateLeaveRequestDto } from './create-leave-request.dto';
import { PickType } from '@nestjs/swagger';

export class LeavePreviewDto extends PickType(CreateLeaveRequestDto, [
  'startDate',
  'endDate',
  'type',
  'period',
] as const) {}

export class LeaveBalanceQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9998)
  year!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class LeaveCalendarQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
}

export class SetLeaveEntitlementDto {
  @IsNumber()
  @ValidateBy({
    name: 'isHalfDay',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'number' && Number.isInteger(value * 2),
      defaultMessage: () => 'days must use increments of 0.5',
    },
  })
  @Min(0)
  @Max(366)
  days!: number;

  @IsInt()
  @Min(0)
  version!: number;
}
