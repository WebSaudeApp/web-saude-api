import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class BuscaService {
  private readonly logger = new Logger(BuscaService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async estaDisponivel(): Promise<boolean> {
    try {
      const resposta = await this.elasticsearchService.ping();
      return !!resposta;
    } catch (erro) {
      this.logger.warn(`Falha na checagem de saúde do Elasticsearch: ${erro}`);
      return false;
    }
  }

  obterCliente(): ElasticsearchService {
    return this.elasticsearchService;
  }
}
