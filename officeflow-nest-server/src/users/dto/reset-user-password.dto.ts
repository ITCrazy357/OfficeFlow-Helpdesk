import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NewPasswordByteLength } from '../../common/security/password-policy';

export class ResetUserPasswordDto {
  @ApiProperty({
    example: 'new-correct-horse-battery-staple',
  })
  @IsString()
  @MinLength(12)
  @NewPasswordByteLength()
  @MaxLength(128)
  password!: string;
}
