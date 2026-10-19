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
  horarios: Array<{
    diaSemana: string;
    horaAbertura: string;
    horaFechamento: string;
    atende24h: boolean;
  }>;
  notaMedia?: number;
  totalReviews?: number;
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
