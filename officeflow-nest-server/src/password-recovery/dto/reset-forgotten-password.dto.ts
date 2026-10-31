import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';
import { NewPasswordByteLength } from '../../common/security/password-policy';

export class ResetForgottenPasswordDto {
  @ApiProperty({ description: 'One-time token received in the reset link' })
  @IsString()
  @Length(43, 43)
  token!: string;

  @ApiProperty({ description: 'New account password' })
  @IsString()
  @MinLength(12)
  @NewPasswordByteLength()
  @MaxLength(128)
  newPassword!: string;
}
