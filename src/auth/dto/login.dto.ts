import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
