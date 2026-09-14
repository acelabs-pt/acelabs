// Exemplo do padrão de tipos + ordenação usado no projecto original.
// Substituir pelas entidades reais do cliente (as datas mensais como chave de texto
// "mês ano" são um padrão que se repetiu em várias tabelas - só ordenar por este
// array e não alfabeticamente, ou os meses saem trocados).

export const MONTH_ORDER = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface Cliente {
  id: number;
  nome: string;
  estado: string;
  data_entrada: string | null;
}

export interface AtividadeMensal {
  id: number;
  data: string; // formato "mes ano", ex. "agosto 26"
  valor_real: number;
  valor_objetivo: number;
}

function sortByMonth<T extends { data: string }>(rows: T[]): T[] {
  const order = Object.fromEntries(MONTH_ORDER.map((m, i) => [m, i]));
  return [...rows].sort((a, b) => {
    const ma = a.data.split(" ")[0];
    const mb = b.data.split(" ")[0];
    return (order[ma] ?? 99) - (order[mb] ?? 99);
  });
}

export function processAtividade(raw: AtividadeMensal[]): AtividadeMensal[] {
  return sortByMonth(raw);
}
