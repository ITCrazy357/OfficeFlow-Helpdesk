import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ChangeUserStatusDto {
  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  isActive!: boolean;
}
