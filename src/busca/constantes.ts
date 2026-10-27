export const ALIAS_ESTABELECIMENTOS = 'estabelecimentos';
export const INDICE_ESTABELECIMENTOS_PADRAO = 'estabelecimentos_v1';

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
            fields: { keyword: { type: 'keyword' } },
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
            fields: { keyword: { type: 'keyword' } },
          },
        },
      },
      horarios: {
        type: 'nested',
        properties: {
          diaSemana: { type: 'keyword' },
          horaAbertura: { type: 'keyword' },
          horaFechamento: { type: 'keyword' },
          atende24h: { type: 'boolean' },
        },
      },
      notaMedia: { type: 'float' },
      totalReviews: { type: 'integer' },
    },
  },
} as const;
