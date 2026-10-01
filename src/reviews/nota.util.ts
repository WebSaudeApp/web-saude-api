export function arredondarNota(media: number | null | undefined): number {
  if (media === null || media === undefined) {
    return 0;
  }
  return Math.round(media * 100) / 100;
}
