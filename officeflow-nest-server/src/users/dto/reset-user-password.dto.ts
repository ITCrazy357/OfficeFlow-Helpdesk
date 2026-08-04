import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({
    example: 'new-correct-horse-battery-staple',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
