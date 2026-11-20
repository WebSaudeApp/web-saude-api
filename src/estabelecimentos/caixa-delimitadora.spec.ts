import { caixaDelimitadora } from './caixa-delimitadora';

const R = 6371;
const rad = (g: number) => (g * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

// Ponto a `km` de (lat, lon) na direção `rumoGraus` (fórmula do destino em esfera).
function destino(lat: number, lon: number, km: number, rumoGraus: number) {
  const d = km / R;
  const b = rad(rumoGraus);
  const lat1 = rad(lat);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b),
  );
  const lon2 =
    rad(lon) +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: deg(lat2), lon: deg(lon2) };
}

describe('caixaDelimitadora', () => {
  it.each([
    [-8.05, -34.88, 1],
    [-8.05, -34.88, 50],
    [-33.7, -53.4, 50], // extremo sul do Brasil
    [5.2, -60.2, 50], // extremo norte
    [-30, -50, 25],
  ])(
    'contém todos os pontos exatamente a raioKm (lat=%d, lon=%d, raio=%d)',
    (lat, lon, raio) => {
      const caixa = caixaDelimitadora(lat, lon, raio);
      for (let rumo = 0; rumo < 360; rumo += 5) {
        const p = destino(lat, lon, raio, rumo);
        expect(p.lat).toBeGreaterThanOrEqual(caixa.latMin);
        expect(p.lat).toBeLessThanOrEqual(caixa.latMax);
        expect(p.lon).toBeGreaterThanOrEqual(caixa.lonMin as number);
        expect(p.lon).toBeLessThanOrEqual(caixa.lonMax as number);
      }
    },
  );

  it('não limita a longitude perto dos polos', () => {
    const caixa = caixaDelimitadora(89.9, 0, 50);
    expect(caixa.lonMin).toBeUndefined();
    expect(caixa.lonMax).toBeUndefined();
  });
});
