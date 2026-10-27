export interface PontoGeografico {
  lat: number;
  lon: number;
}

export interface DocumentoEstabelecimento {
  id: string;
  nome: string;
  tipo: {
    id: string;
    nome: string;
  };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string | null;
    bairro?: string | null;
    cidade: string;
    estado: string;
  };
  localizacao: PontoGeografico;
  especialidades: Array<{
    id: string;
    nome: string;
  }>;
  horarios?: Array<{
    diaSemana: string;
    horaAbertura: string;
    horaFechamento: string;
    atende24h: boolean;
  }>;
  notaMedia?: number;
  totalReviews?: number;
}

export interface DadosEstabelecimentoParaIndexacao {
  id: string;
  nome: string;
  tipo: {
    id: string;
    nome: string;
  };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string | null;
    bairro?: string | null;
    cidade: string;
    estado: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  especialidades?: Array<{
    id: string;
    nome: string;
  }>;
  horarios?: Array<{
    diaSemana: string;
    horaAbertura: string;
    horaFechamento: string;
    atende24h: boolean;
  }>;
  notaMedia?: number;
  totalReviews?: number;
}

export function mapearEstabelecimentoParaDocumento(
  dados: DadosEstabelecimentoParaIndexacao,
): DocumentoEstabelecimento {
  return {
    id: dados.id,
    nome: dados.nome,
    tipo: {
      id: dados.tipo.id,
      nome: dados.tipo.nome,
    },
    endereco: {
      cep: dados.endereco.cep,
      logradouro: dados.endereco.logradouro,
      numero: dados.endereco.numero,
      complemento: dados.endereco.complemento ?? null,
      bairro: dados.endereco.bairro ?? null,
      cidade: dados.endereco.cidade,
      estado: dados.endereco.estado,
    },
    localizacao: {
      lat: dados.endereco.latitude ?? NaN,
      lon: dados.endereco.longitude ?? NaN,
    },
    especialidades: (dados.especialidades ?? []).map((esp) => ({
      id: esp.id,
      nome: esp.nome,
    })),
    horarios: (dados.horarios ?? []).map((h) => ({
      diaSemana: h.diaSemana,
      horaAbertura: h.horaAbertura,
      horaFechamento: h.horaFechamento,
      atende24h: h.atende24h,
    })),
    notaMedia: dados.notaMedia ?? 0,
    totalReviews: dados.totalReviews ?? 0,
  };
}

export interface ParametrosBuscaEstabelecimentos {
  termo?: string;
  tipo?: string;
  especialidade?: string;
  cidade?: string;
  estado?: string;
  localizacao?: {
    lat: number;
    lon: number;
    raioKm: number;
  };
  pagina?: number;
  limite?: number;
}

export interface ItemResultadoBusca {
  estabelecimento: DocumentoEstabelecimento;
  distanciaKm?: number;
  score?: number | null;
}

export interface ResultadoBuscaEstabelecimentos {
  itens: ItemResultadoBusca[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export function coordenadasSaoValidas(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return false;
  }
  if (lat < -90 || lat > 90) {
    return false;
  }
  if (lon < -180 || lon > 180) {
    return false;
  }
  return true;
}
