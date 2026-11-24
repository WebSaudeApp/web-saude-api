import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class EnderecoDto {
  @ApiProperty({ example: '50000000' })
  @IsString()
  @MinLength(8)
  @MaxLength(9)
  cep!: string;

  @ApiProperty({ example: 'Rua das Flores' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  logradouro!: string;

  @ApiProperty({ example: '100' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  numero!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  complemento?: string;

  @ApiPropertyOptional({ example: 'Boa Viagem' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  bairro?: string;

  @ApiProperty({ example: 'Recife' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  cidade!: string;

  @ApiProperty({ example: 'PE' })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  estado!: string;

  @ApiProperty({
    example: -8.0476,
    description: 'Latitude no território brasileiro (entre -34 e 6)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude deve ser um número válido' })
  @Min(-34, {
    message:
      'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
  })
  @Max(6, {
    message:
      'Latitude deve estar dentro do território brasileiro (entre -34 e 6)',
  })
  latitude!: number;

  @ApiProperty({
    example: -34.877,
    description: 'Longitude no território brasileiro (entre -74 e -28)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude deve ser um número válido' })
  @Min(-74, {
    message:
      'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
  })
  @Max(-28, {
    message:
      'Longitude deve estar dentro do território brasileiro (entre -74 e -28)',
  })
  longitude!: number;
}

export class UpdateEnderecoDto extends PartialType(EnderecoDto) {}
