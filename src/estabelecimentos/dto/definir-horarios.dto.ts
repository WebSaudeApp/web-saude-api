import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiaSemana } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { HORA_PATTERN } from '../horario.util';

export class HorarioItemDto {
  @ApiProperty({ enum: DiaSemana })
  @IsEnum(DiaSemana)
  diaSemana!: DiaSemana;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Obrigatório quando atende24h é false',
  })
  @ValidateIf((item: HorarioItemDto) => !item.atende24h)
  @IsString()
  @Matches(HORA_PATTERN)
  horaAbertura?: string;

  @ApiPropertyOptional({
    example: '18:00',
    description: 'Obrigatório quando atende24h é false',
  })
  @ValidateIf((item: HorarioItemDto) => !item.atende24h)
  @IsString()
  @Matches(HORA_PATTERN)
  horaFechamento?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  atende24h?: boolean;
}

export class DefinirHorariosDto {
  @ApiProperty({ type: [HorarioItemDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => HorarioItemDto)
  horarios!: HorarioItemDto[];
}
