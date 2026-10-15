import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginacaoQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Use um número inteiro.' })
  @Min(1, { message: 'Use um valor maior ou igual a 1.' })
  pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Use um número inteiro.' })
  @Min(1, { message: 'Use um valor de 1 a 100.' })
  @Max(100, { message: 'Use um valor de 1 a 100.' })
  limite = 20;
}

export type PaginacaoResult<T> = {
  dados: T[];
  paginacao: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
};

export function paginada<T>(
  dados: T[],
  total: number,
  pagina: number,
  limite: number,
): PaginacaoResult<T> {
  return {
    dados,
    paginacao: {
      pagina,
      limite,
      total,
      totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
    },
  };
}
