import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  ALIAS_ESTABELECIMENTOS,
  CONFIGURACAO_INDICE_ESTABELECIMENTOS,
  INDICE_ESTABELECIMENTOS_PADRAO,
} from './constantes';
import {
  coordenadasSaoValidas,
  DocumentoEstabelecimento,
} from './documento-estabelecimento';

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

  async indexarEstabelecimento(
    documento: DocumentoEstabelecimento,
  ): Promise<void> {
    const lat = documento.localizacao?.lat;
    const lon = documento.localizacao?.lon;

    if (!coordenadasSaoValidas(lat, lon)) {
      this.logger.error(
        `Falha na indexação do estabelecimento ${documento.id}: coordenadas inválidas (lat: ${lat}, lon: ${lon}).`,
      );
      throw new BadRequestException(
        `Coordenadas geográficas inválidas para o estabelecimento ${documento.id}.`,
      );
    }

    try {
      await this.elasticsearchService.index({
        index: ALIAS_ESTABELECIMENTOS,
        id: documento.id,
        document: documento,
      });
    } catch (erro) {
      this.logger.error(
        `Erro ao indexar estabelecimento ${documento.id} no Elasticsearch: ${erro}`,
      );
      throw erro;
    }
  }

  async obterEstabelecimentoPorId(
    id: string,
  ): Promise<DocumentoEstabelecimento | null> {
    try {
      const resposta =
        await this.elasticsearchService.get<DocumentoEstabelecimento>({
          index: ALIAS_ESTABELECIMENTOS,
          id,
        });

      return (resposta._source as DocumentoEstabelecimento) ?? null;
    } catch (erro: unknown) {
      const e = erro as { statusCode?: number; meta?: { statusCode?: number } };
      if (e?.statusCode === 404 || e?.meta?.statusCode === 404) {
        return null;
      }
      this.logger.error(
        `Erro ao buscar estabelecimento ${id} no Elasticsearch: ${String(erro)}`,
      );
      throw erro;
    }
  }

  async removerEstabelecimento(id: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: ALIAS_ESTABELECIMENTOS,
        id,
      });
    } catch (erro: unknown) {
      const e = erro as { statusCode?: number; meta?: { statusCode?: number } };
      if (e?.statusCode === 404 || e?.meta?.statusCode === 404) {
        return;
      }
      this.logger.error(
        `Erro ao remover estabelecimento ${id} do Elasticsearch: ${String(erro)}`,
      );
      throw erro;
    }
  }
}
