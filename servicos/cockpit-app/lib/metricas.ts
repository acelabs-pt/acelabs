import { inicioDaSemana, somarDias } from "@/lib/datas";

export type Metrica = "visitas" | "reunioes_angariacao" | "angariacoes" | "transacoes";
export type Periodo = "semana" | "mes" | "trimestre" | "ano";

export const METRICAS: { id: Metrica; label: string }[] = [
  { id: "visitas", label: "Visitas" },
  { id: "reunioes_angariacao", label: "Reuniões de angariação" },
  { id: "angariacoes", label: "Angariações" },
  { id: "transacoes", label: "Transações" },
];

export type Metas = {
  ano: number;
  semanasUteis: number;
  // objetivo máximo do ano, em euros
  faturacaoAnual: number | null;
  anual: Record<Metrica, number | null>;
  // visitas por transação e reuniões por angariação
  visitasPorTransacao: number | null;
  reunioesPorAngariacao: number | null;
};

/** Início (inclusivo) e fim (exclusivo) do período que contém `ref`. */
export function limites(p: Periodo, ref: Date = new Date()): { ini: Date; fim: Date } {
  if (p === "semana") {
    const ini = inicioDaSemana(ref);
    return { ini, fim: somarDias(ini, 7) };
  }
  if (p === "mes") return { ini: new Date(ref.getFullYear(), ref.getMonth(), 1), fim: new Date(ref.getFullYear(), ref.getMonth() + 1, 1) };
  if (p === "trimestre") {
    const m0 = Math.floor(ref.getMonth() / 3) * 3;
    return { ini: new Date(ref.getFullYear(), m0, 1), fim: new Date(ref.getFullYear(), m0 + 3, 1) };
  }
  return { ini: new Date(ref.getFullYear(), 0, 1), fim: new Date(ref.getFullYear() + 1, 0, 1) };
}

export const dentro = (d: Date, l: { ini: Date; fim: Date }) => d >= l.ini && d < l.fim;

/** Meta de um período a partir da meta anual: semana = anual / semanas úteis, mês = anual / 12. */
export function metaDoPeriodo(anual: number, p: Periodo, semanasUteis: number): number {
  if (p === "ano") return anual;
  if (p === "mes") return anual / 12;
  if (p === "trimestre") return anual / 4;
  return anual / Math.max(1, semanasUteis);
}

/** Calculadora do desenho: metas anuais de visitas e reuniões a partir das taxas de conversão. */
export function calcular(
  transacoes: number | null,
  angariacoes: number | null,
  visitasPorTransacao: number | null,
  reunioesPorAngariacao: number | null
): { visitas: number | null; reunioes: number | null } {
  return {
    visitas: transacoes != null && visitasPorTransacao != null ? Math.round(transacoes * visitasPorTransacao) : null,
    reunioes: angariacoes != null && reunioesPorAngariacao != null ? Math.round(angariacoes * reunioesPorAngariacao) : null,
  };
}

// 2 em vez de 2,0 e 2,3 em vez de 2,25
export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
}

// "1 reunião" / "2 reuniões"
export const plural = (n: number, um: string, varios: string) => `${fmtNum(n)} ${n === 1 ? um : varios}`;
