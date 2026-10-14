import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdicionarMidiaDto {
  @ApiPropertyOptional({ example: 'Fachada' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legenda?: string;
}
