/** Minúsculas, sem acentos e com espaços simples: para comparar descrições de extratos e regras. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function data(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" -> "novembro de 2026" */
export function nomeMes(anoMes: string): string {
  const [a, m] = anoMes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** "2026-11" -> "Novembro de 2026" (para títulos) */
export function mesTitulo(anoMes: string): string {
  const n = nomeMes(anoMes);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "2026-11" -> "nov 26" (para colunas estreitas) */
export function mesCurto(anoMes: string): string {
  const [a, m] = anoMes.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)} ${String(a).slice(2)}`;
}

/** Data de hoje em Lisboa, em ISO (AAAA-MM-DD). */
export function hojeLisboa(agora = new Date()): string {
  return agora.toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
}
