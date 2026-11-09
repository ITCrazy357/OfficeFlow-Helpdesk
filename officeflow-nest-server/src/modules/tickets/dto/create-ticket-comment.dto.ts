import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketCommentDto {
  @ApiProperty({
    example: 'I have checked the VPN configuration and reset your profile',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(15_000)
  content!: string;
}
