import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CriarEspecialidadeDto {
  @ApiProperty({ example: 'Cardiologia' })
  @IsString({ message: 'Informe um texto.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  nome!: string;
}
