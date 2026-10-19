import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  ALIAS_ESTABELECIMENTOS,
  CONFIGURACAO_INDICE_ESTABELECIMENTOS,
  INDICE_ESTABELECIMENTOS_PADRAO,
} from './constantes';

@Injectable()
export class BuscaService implements OnModuleInit {
  private readonly logger = new Logger(BuscaService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    try {
      const disponivel = await this.estaDisponivel();
      if (disponivel) {
        await this.inicializarIndice();
      } else {
        this.logger.warn(
          'Elasticsearch não está disponível no início. O índice será inicializado na primeira requisição disponível.',
        );
      }
    } catch (erro) {
      this.logger.warn(
        `Não foi possível inicializar o índice na inicialização: ${erro}`,
      );
    }
  }

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

  async indiceExiste(indice: string): Promise<boolean> {
    return this.elasticsearchService.indices.exists({ index: indice });
  }

  async aliasExiste(alias: string): Promise<boolean> {
    return this.elasticsearchService.indices.existsAlias({ name: alias });
  }

  async inicializarIndice(
    indice: string = INDICE_ESTABELECIMENTOS_PADRAO,
    alias: string = ALIAS_ESTABELECIMENTOS,
  ): Promise<{ criado: boolean; aliasCriado: boolean }> {
    let criado = false;
    let aliasCriado = false;

    const existeIndice = await this.indiceExiste(indice);
    if (!existeIndice) {
      this.logger.log(
        `Criando índice ${indice} com mapeamento e analisador asciifolding...`,
      );
      await this.elasticsearchService.indices.create({
        index: indice,
        ...CONFIGURACAO_INDICE_ESTABELECIMENTOS,
      });
      criado = true;
      this.logger.log(`Índice ${indice} criado com sucesso.`);
    }

    const existeAlias = await this.aliasExiste(alias);
    if (!existeAlias) {
      this.logger.log(`Apontando alias ${alias} para o índice ${indice}...`);
      await this.elasticsearchService.indices.putAlias({
        index: indice,
        name: alias,
      });
      aliasCriado = true;
      this.logger.log(`Alias ${alias} configurado com sucesso.`);
    }

    return { criado, aliasCriado };
  }
}
