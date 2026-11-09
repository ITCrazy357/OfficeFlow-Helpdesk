import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ChangeAccountLockDto {
  @ApiProperty({
    example: true,
    description: 'True to lock the account, false to unlock it',
  })
  @IsBoolean()
  isLocked!: boolean;
}
