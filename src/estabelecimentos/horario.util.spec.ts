import { dateParaHora, HORA_PATTERN, horaParaDate } from './horario.util';

describe('horario.util', () => {
  it('converte HH:MM para Date e volta', () => {
    expect(dateParaHora(horaParaDate('08:30'))).toBe('08:30');
    expect(dateParaHora(horaParaDate('23:59'))).toBe('23:59');
  });

  it('aceita só horas válidas no formato HH:MM', () => {
    expect(HORA_PATTERN.test('00:00')).toBe(true);
    expect(HORA_PATTERN.test('24:00')).toBe(false);
    expect(HORA_PATTERN.test('8:00')).toBe(false);
  });
});
