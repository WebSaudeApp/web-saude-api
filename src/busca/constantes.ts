export const ALIAS_ESTABELECIMENTOS =
  process.env.ELASTICSEARCH_ALIAS_ESTABELECIMENTOS || 'estabelecimentos';
export const INDICE_ESTABELECIMENTOS_PADRAO =
  process.env.ELASTICSEARCH_INDEX_ESTABELECIMENTOS || 'estabelecimentos_v1';

export const CONFIGURACAO_INDICE_ESTABELECIMENTOS = {
  settings: {
    analysis: {
      analyzer: {
        analisador_texto: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
      normalizer: {
        normalizador_exato: {
          type: 'custom',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      nome: {
        type: 'text',
        analyzer: 'analisador_texto',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      tipo: {
        properties: {
          id: { type: 'keyword' },
          nome: { type: 'keyword' },
        },
      },
      endereco: {
        properties: {
          cep: { type: 'keyword' },
          logradouro: { type: 'text', analyzer: 'analisador_texto' },
          numero: { type: 'keyword' },
          complemento: { type: 'text', analyzer: 'analisador_texto' },
          bairro: {
            type: 'text',
            analyzer: 'analisador_texto',
            fields: { keyword: { type: 'keyword' } },
          },
          cidade: {
            type: 'text',
            analyzer: 'analisador_texto',
            fields: {
              keyword: {
                type: 'keyword',
                normalizer: 'normalizador_exato',
              },
            },
          },
          estado: { type: 'keyword' },
        },
      },
      localizacao: {
        type: 'geo_point',
      },
      especialidades: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          nome: {
            type: 'text',
            analyzer: 'analisador_texto',
            fields: {
              keyword: {
                type: 'keyword',
                normalizer: 'normalizador_exato',
              },
            },
          },
        },
      },
      notaMedia: { type: 'float' },
      totalReviews: { type: 'integer' },
    },
  },
} as const;
