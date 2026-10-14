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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class UpdateEnderecoDto extends PartialType(EnderecoDto) {}
