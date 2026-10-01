export const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Colunas @db.Time chegam do Prisma como Date no dia 1970-01-01 (UTC).
export function horaParaDate(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}

export function dateParaHora(date: Date): string {
  return date.toISOString().slice(11, 16);
}
