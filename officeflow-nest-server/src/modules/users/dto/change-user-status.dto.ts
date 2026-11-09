import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ChangeUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'True for an active employee, false for a deactivated user',
  })
  @IsBoolean()
  isActive!: boolean;
}
