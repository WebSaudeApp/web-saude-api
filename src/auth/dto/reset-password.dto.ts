import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ example: 'novaSenhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
