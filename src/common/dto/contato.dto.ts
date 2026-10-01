import { ApiProperty } from '@nestjs/swagger';
import { TipoContato } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class ContatoDto {
  @ApiProperty({ enum: TipoContato, example: TipoContato.TELEFONE })
  @IsEnum(TipoContato)
  tipo!: TipoContato;

  @ApiProperty({ example: '8133334444' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  valor!: string;
}
