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
  ItemResultadoBusca,
  ParametrosBuscaEstabelecimentos,
  ResultadoBuscaEstabelecimentos,
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
        `Não foi possível inicializar o índice na inicialização: ${String(erro)}`,
      );
    }
  }

  async estaDisponivel(): Promise<boolean> {
    try {
      const resposta = await this.elasticsearchService.ping();
      return !!resposta;
    } catch (erro) {
      this.logger.warn(
        `Falha na checagem de saúde do Elasticsearch: ${String(erro)}`,
      );
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
        `Erro ao indexar estabelecimento ${documento.id} no Elasticsearch: ${String(erro)}`,
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

  async buscarEstabelecimentos(
    parametros: ParametrosBuscaEstabelecimentos = {},
  ): Promise<ResultadoBuscaEstabelecimentos> {
    const {
      termo,
      tipo,
      especialidade,
      cidade,
      estado,
      localizacao,
      pagina = 1,
      limite = 20,
    } = parametros;

    const from = Math.max(0, (pagina - 1) * limite);
    const size = Math.max(1, limite);

    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];
    const sort: Record<string, unknown>[] = [];

    // 1. Busca textual por termo (nome, cidade, bairro, logradouro e especialidades)
    if (termo && termo.trim()) {
      const termoLimpo = termo.trim();
      must.push({
        bool: {
          should: [
            {
              multi_match: {
                query: termoLimpo,
                fields: [
                  'nome^3',
                  'endereco.cidade^2',
                  'endereco.bairro^2',
                  'endereco.logradouro',
                ],
                fuzziness: 'AUTO',
              },
            },
            {
              nested: {
                path: 'especialidades',
                query: {
                  match: {
                    'especialidades.nome': termoLimpo,
                  },
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    // 2. Filtro por tipo de estabelecimento
    if (tipo && tipo.trim()) {
      filter.push({
        term: {
          'tipo.nome': tipo.trim().toUpperCase(),
        },
      });
    }

    // 3. Filtro por especialidade (id ou nome)
    if (especialidade && especialidade.trim()) {
      const espLimpa = especialidade.trim();
      filter.push({
        nested: {
          path: 'especialidades',
          query: {
            bool: {
              should: [
                { term: { 'especialidades.id': espLimpa } },
                { match: { 'especialidades.nome': espLimpa } },
              ],
            },
          },
        },
      });
    }

    // 4. Filtro por cidade
    if (cidade && cidade.trim()) {
      filter.push({
        match: {
          'endereco.cidade': cidade.trim(),
        },
      });
    }

    // 5. Filtro por UF/estado
    if (estado && estado.trim()) {
      filter.push({
        term: {
          'endereco.estado': estado.trim().toUpperCase(),
        },
      });
    }

    // 6. Filtro geográfico geo_distance e ordenação por proximidade
    if (
      localizacao &&
      coordenadasSaoValidas(localizacao.lat, localizacao.lon)
    ) {
      const raioKm = localizacao.raioKm > 0 ? localizacao.raioKm : 10;
      filter.push({
        geo_distance: {
          distance: `${raioKm}km`,
          localizacao: {
            lat: localizacao.lat,
            lon: localizacao.lon,
          },
        },
      });

      sort.push({
        _geo_distance: {
          localizacao: {
            lat: localizacao.lat,
            lon: localizacao.lon,
          },
          order: 'asc',
          unit: 'km',
          mode: 'min',
          distance_type: 'arc',
        },
      });
      sort.push({ 'nome.keyword': { order: 'asc' } });
      sort.push({ id: { order: 'asc' } });
    } else {
      sort.push({ 'nome.keyword': { order: 'asc' } });
      sort.push({ id: { order: 'asc' } });
    }

    const query: Record<string, unknown> = {};
    if (must.length > 0 || filter.length > 0) {
      query.bool = {
        ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
        ...(filter.length > 0 ? { filter } : {}),
      };
    } else {
      query.match_all = {};
    }

    try {
      const resposta =
        await this.elasticsearchService.search<DocumentoEstabelecimento>({
          index: ALIAS_ESTABELECIMENTOS,
          query,
          from,
          size,
          ...(sort.length > 0 ? { sort } : {}),
        });

      const totalHits =
        typeof resposta.hits.total === 'number'
          ? resposta.hits.total
          : (resposta.hits.total?.value ?? 0);

      const itens: ItemResultadoBusca[] = (resposta.hits.hits ?? []).map(
        (hit) => {
          let distanciaKm: number | undefined;
          if (
            hit.sort &&
            Array.isArray(hit.sort) &&
            typeof hit.sort[0] === 'number'
          ) {
            distanciaKm = Math.round(hit.sort[0] * 100) / 100;
          }

          return {
            estabelecimento: hit._source as DocumentoEstabelecimento,
            distanciaKm,
            score: hit._score,
          };
        },
      );

      return {
        itens,
        total: totalHits,
        pagina,
        totalPaginas: Math.ceil(totalHits / size),
      };
    } catch (erro) {
      this.logger.error(
        `Erro ao buscar estabelecimentos no Elasticsearch: ${String(erro)}`,
      );
      throw erro;
    }
  }
}
