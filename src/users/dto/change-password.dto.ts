import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'novaSenhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
