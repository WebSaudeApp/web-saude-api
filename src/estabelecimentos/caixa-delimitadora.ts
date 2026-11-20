/**
 * Retângulo (em graus) que sempre contém o círculo de `raioKm` ao redor de (lat, lon).
 * Usado no fallback do PostgreSQL antes do Haversine, para o índice (latitude, longitude)
 * poder ser usado. Folga conservadora: 1° de latitude >= 110,5 km e 1° de longitude
 * >= 110 km * cos(lat); o Haversine decide o limite exato.
 */
export interface CaixaDelimitadora {
  latMin: number;
  latMax: number;
  lonMin?: number;
  lonMax?: number;
}

export function caixaDelimitadora(
  lat: number,
  lon: number,
  raioKm: number,
): CaixaDelimitadora {
  const deltaLat = raioKm / 110;
  const caixa: CaixaDelimitadora = {
    latMin: lat - deltaLat,
    latMax: lat + deltaLat,
  };
  const cosLat = Math.cos((lat * Math.PI) / 180);
  // Perto dos polos o círculo cobre todas as longitudes: não limita a longitude.
  if (cosLat > 0.01) {
    const deltaLon = raioKm / (110 * cosLat);
    caixa.lonMin = lon - deltaLon;
    caixa.lonMax = lon + deltaLon;
  }
  return caixa;
}
