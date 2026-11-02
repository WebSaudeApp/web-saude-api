import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaginacaoQueryDto } from '../../common/dto/paginacao-query.dto';

export class BuscarEstabelecimentosDto extends PaginacaoQueryDto {
  @ApiPropertyOptional({
    description: 'Busca em nome, cidade, bairro e especialidades',
  })
  @IsOptional()
  @IsString({ message: 'Informe um texto.' })
  termo?: string;

  @ApiPropertyOptional({ example: 'HOSPITAL' })
  @IsOptional()
  @IsString({ message: 'Informe um texto.' })
  tipo?: string;

  @ApiPropertyOptional({ description: 'Id ou nome da especialidade' })
  @IsOptional()
  @IsString({ message: 'Informe um texto.' })
  especialidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Informe um texto.' })
  cidade?: string;

  @ApiPropertyOptional({ example: 'PE', minLength: 2, maxLength: 2 })
  @IsOptional()
  @IsString({ message: 'Informe a sigla de duas letras da UF.' })
  @Matches(/^[a-z]{2}$/i, {
    message: 'Informe a sigla de duas letras da UF.',
  })
  estado?: string;

  @ApiPropertyOptional({
    description:
      'Latitude para busca geográfica por proximidade (entre -90 e 90)',
    example: -8.0476,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude deve ser um número válido.' })
  @Min(-90, { message: 'Latitude deve estar entre -90 e 90.' })
  @Max(90, { message: 'Latitude deve estar entre -90 e 90.' })
  lat?: number;

  @ApiPropertyOptional({
    description:
      'Longitude para busca geográfica por proximidade (entre -180 e 180)',
    example: -34.877,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude deve ser um número válido.' })
  @Min(-180, { message: 'Longitude deve estar entre -180 e 180.' })
  @Max(180, { message: 'Longitude deve estar entre -180 e 180.' })
  lng?: number;

  @ApiPropertyOptional({
    description: 'Raio de busca em quilômetros (padrão 10 km, máximo 50 km)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O raio deve ser um número inteiro.' })
  @Min(1, { message: 'O raio deve ser de pelo menos 1 km.' })
  @Max(50, { message: 'O raio máximo permitido é de 50 km.' })
  raioKm?: number;
}
