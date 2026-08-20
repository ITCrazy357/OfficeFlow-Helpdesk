import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeMyPasswordDto {
  @ApiProperty({
    description: 'The current password of the user',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description: 'The new password for the user',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
