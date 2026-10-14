import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { EnderecoDto } from '../../common/dto/endereco.dto';

export class CriarEstabelecimentoDto {
  @ApiProperty({ example: 'Hospital Recife' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @ApiProperty({
    example: 'HOSPITAL',
    description:
      'Nome de um tipo de estabelecimento (GET /estabelecimentos/tipos)',
  })
  @IsString()
  @MinLength(1)
  tipo!: string;

  @ApiProperty({ type: EnderecoDto })
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco!: EnderecoDto;

  @ApiPropertyOptional({ type: [ContatoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContatoDto)
  contatos?: ContatoDto[];
}
