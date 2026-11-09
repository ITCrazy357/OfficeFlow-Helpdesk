import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class HandoffUserDto {
  @ApiProperty({
    description:
      'Active, unlocked MANAGER or ADMIN receiving reports and pending approvals',
    example: 3,
  })
  @IsInt()
  @Min(1)
  replacementId!: number;
}
