import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '81999998888' })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ enum: [UserRole.PATIENT, UserRole.FUNCTIONAL] })
  @IsIn([UserRole.PATIENT, UserRole.FUNCTIONAL], {
    message: 'O cadastro público aceita somente PATIENT ou FUNCTIONAL.',
  })
  role!: UserRole;
}
