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
    // ES no ar mas sem o índice (es:init não rodou) também é degradação: a busca por
    // localização está indo toda para o fallback, e isso precisa aparecer aqui.
    const indiceDisponivel =
      elasticsearchConectado && (await this.buscaService.indiceDisponivel());

    const corpo: RespostaDisponibilidadeDto = {
      status: !bancoConectado
        ? 'erro'
        : elasticsearchConectado && indiceDisponivel
          ? 'ok'
          : 'degradado',
      banco: bancoConectado ? 'conectado' : 'desconectado',
      elasticsearch: elasticsearchConectado ? 'conectado' : 'desconectado',
      indiceBusca: indiceDisponivel ? 'disponivel' : 'ausente',
    };

    // Só o banco decide o status HTTP (o health check da hospedagem usa esta rota).
    // O ES fora derruba apenas a busca por localização; o corpo informa o estado.
    if (!bancoConectado) {
      throw new ServiceUnavailableException(corpo);
    }

    return corpo;
  }
}
