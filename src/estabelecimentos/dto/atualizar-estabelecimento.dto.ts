import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ContatoDto } from '../../common/dto/contato.dto';
import { UpdateEnderecoDto } from '../../common/dto/endereco.dto';

export class AtualizarEstabelecimentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome?: string;

  @ApiPropertyOptional({ example: 'CLINIC' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  tipo?: string;

  @ApiPropertyOptional({ type: UpdateEnderecoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEnderecoDto)
  endereco?: UpdateEnderecoDto;

  @ApiPropertyOptional({
    type: [ContatoDto],
    description: 'Substitui todos os contatos da unidade.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContatoDto)
  contatos?: ContatoDto[];
}
