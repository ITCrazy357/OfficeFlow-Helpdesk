import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'Nguyen Van A',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'employee@officeflow.com',
  })
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description: 'Initial password, 12 to 128 characters',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.EMPLOYEE,
  })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    example: 1,
  })
  @IsInt()
  @Min(1)
  departmentId!: number;
}
