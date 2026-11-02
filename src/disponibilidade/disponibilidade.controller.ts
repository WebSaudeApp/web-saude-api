import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';
import { BuscaService } from '../busca/busca.service';
import {
  RespostaDisponibilidadeDto,
  RespostaRaizDto,
} from './dto/resposta-disponibilidade.dto';

@ApiTags('Disponibilidade')
@Controller()
export class DisponibilidadeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buscaService: BuscaService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Indica que a API está no ar' })
  @ApiOkResponse({ type: RespostaRaizDto })
  raiz(): RespostaRaizDto {
    return { mensagem: 'api online' };
  }

  @Get(['health', 'disponibilidade'])
  @SkipThrottle()
  @ApiOperation({
    summary: 'Verifica se a API, o banco e o Elasticsearch estão disponíveis',
  })
  @ApiOkResponse({ type: RespostaDisponibilidadeDto })
  async verificar(): Promise<RespostaDisponibilidadeDto> {
    const [bancoConectado, elasticsearchConectado] = await Promise.all([
      this.prisma.isDatabaseConnected(),
      this.buscaService.estaDisponivel(),
    ]);

    if (!bancoConectado || !elasticsearchConectado) {
      throw new ServiceUnavailableException({
        status: 'erro',
        banco: bancoConectado ? 'conectado' : 'desconectado',
        elasticsearch: elasticsearchConectado ? 'conectado' : 'desconectado',
      });
    }

    return {
      status: 'ok',
      banco: 'conectado',
      elasticsearch: 'conectado',
    };
  }
}
