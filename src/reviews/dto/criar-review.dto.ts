import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CriarReviewDto {
  @ApiProperty({ description: 'Id do usuário autor da avaliação' })
  @IsUUID('4')
  autorId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  nota!: number;

  @ApiPropertyOptional({ example: 'Atendimento rápido e equipe atenciosa.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
