import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ContatoDto } from '../../common/dto/contato.dto';
import { EnderecoDto } from '../../common/dto/endereco.dto';

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @ApiPropertyOptional({ example: '12345678909' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, {
    message: 'cpf deve ter 11 dígitos',
  })
  cpf?: string;

  @ApiPropertyOptional({ example: 'Feminino' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  genero?: string;

  @ApiProperty({
    example: 'PATIENT',
    description: 'Nome de um tipo de usuário (GET /usuarios/tipos)',
  })
  @IsString()
  @MinLength(1)
  tipo!: string;

  @ApiPropertyOptional({ type: EnderecoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;

  @ApiPropertyOptional({ type: [ContatoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContatoDto)
  contatos?: ContatoDto[];
}
