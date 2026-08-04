import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Full name of the user',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: 'employee@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description: 'User password, 12 to 128 characters',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Department ID of the user',
  })
  @IsOptional()
  @IsInt()
  departmentId?: number;
}
