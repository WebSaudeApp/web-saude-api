import { ApiProperty } from '@nestjs/swagger';

export class RespostaRaizDto {
  @ApiProperty({ example: 'api online' })
  mensagem!: string;
}

export class RespostaDisponibilidadeDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'erro'] })
  status!: 'ok' | 'erro';

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
}
