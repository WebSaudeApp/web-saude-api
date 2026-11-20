import { ApiProperty } from '@nestjs/swagger';

export class RespostaRaizDto {
  @ApiProperty({ example: 'api online' })
  mensagem!: string;
}

export class RespostaDisponibilidadeDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degradado', 'erro'] })
  status!: 'ok' | 'degradado' | 'erro';

  @ApiProperty({
    example: 'conectado',
    enum: ['conectado', 'desconectado'],
  })
  banco!: 'conectado' | 'desconectado';

  @ApiProperty({
    example: 'conectado',
    enum: ['conectado', 'desconectado'],
  })
  elasticsearch!: 'conectado' | 'desconectado';

  @ApiProperty({
    example: 'disponivel',
    enum: ['disponivel', 'ausente', 'desconhecido'],
  })
  indiceBusca!: 'disponivel' | 'ausente' | 'desconhecido';
}
