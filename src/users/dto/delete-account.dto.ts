import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
