import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSpecialtyDto {
  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
