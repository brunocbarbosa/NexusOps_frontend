/**
 * O backend fala ISO 8601 UTC. A tela mostra a data no fuso de quem lê.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);

  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMAT.format(date);
}
