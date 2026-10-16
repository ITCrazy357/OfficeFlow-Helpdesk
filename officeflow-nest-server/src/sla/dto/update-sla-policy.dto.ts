import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { SlaPolicyConfig } from '../sla-policy';

class WorkingIntervalDto {
  @IsString() @MaxLength(5) start!: string;
  @IsString() @MaxLength(5) end!: string;
}

class SlaTargetDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(43200)
  responseMinutes!: number | null;
  @IsInt() @Min(1) @Max(43200) resolutionMinutes!: number;
}

class SlaTargetsDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaTargetDto)
  URGENT!: SlaTargetDto;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaTargetDto)
  HIGH!: SlaTargetDto;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaTargetDto)
  MEDIUM!: SlaTargetDto;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaTargetDto)
  LOW!: SlaTargetDto;
}

export class SlaPolicyConfigDto implements SlaPolicyConfig {
  @IsIn(['CALENDAR', 'BUSINESS']) mode!: 'CALENDAR' | 'BUSINESS';
  @IsString() @MaxLength(100) timezone!: string;
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays!: number[];
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => WorkingIntervalDto)
  workingHours!: WorkingIntervalDto[];
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  holidays!: string[];
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaTargetsDto)
  targets!: SlaTargetsDto;
  @IsInt() @Min(0) @Max(10080) warningMinutes!: number;
  @IsIn(['NONE', 'ADMINS', 'ADMINS_AND_MANAGER']) escalation!:
    'NONE' | 'ADMINS' | 'ADMINS_AND_MANAGER';
}

export class UpdateSlaPolicyDto {
  @IsInt() @Min(0) version!: number;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SlaPolicyConfigDto)
  config!: SlaPolicyConfigDto;
}
