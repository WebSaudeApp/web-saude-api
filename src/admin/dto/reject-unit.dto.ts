import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectUnitDto {
  @ApiProperty({ example: 'Endereço incompleto ou ilegível.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
