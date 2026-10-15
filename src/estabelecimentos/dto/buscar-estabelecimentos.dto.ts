import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
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
}
