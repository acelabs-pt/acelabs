// Estado de cada débito direto: já saiu este ciclo? quanto saiu de facto? Usa os movimentos ligados ao débito (por regra
// ou à mão). Os limites são os mesmos dos avisos do Início (calculos.ts), para os dois sítios dizerem o mesmo. Testado.

import { cobrancaAnterior, proximaCobranca, somarDias } from "./calculos";
import type { Movimento, Subscricao } from "./tipos";

export type EstadoDebito = {
  /** pago: o pagamento deste ciclo já está no banco; em_falta: devia ter saído e não aparece; a_seguir: ainda não chegou a altura;
   *  sem_pagamentos: ainda não há nenhum movimento ligado a este débito (não se sabe). */
  estado: "pago" | "em_falta" | "a_seguir" | "sem_pagamentos";
  ultimo: Movimento | null;
  /** Cobrança prevista mais recente até hoje. */
  anterior: string | null;
  proxima: string;
  /** O último pagamento foi diferente do previsto (mais de 5% ou de 1 €). */
  diferente: boolean;
  /** Quando está em falta: a cobrança (com mais de 7 dias) que não apareceu. */
  faltaDe: string | null;
};

export function estadoDebito(s: Subscricao, movimentos: Movimento[], hoje: string): EstadoDebito {
  const pagos = movimentos.filter((m) => m.subscricao_id === s.id && m.valor < 0).sort((a, b) => (a.data < b.data ? 1 : -1));
  const ultimo = pagos[0] ?? null;
  const anterior = cobrancaAnterior(s, hoje);
  const proxima = proximaCobranca(s, hoje);
  const diferente = Boolean(ultimo && s.valor_previsto && Math.abs(-ultimo.valor - s.valor_previsto) > Math.max(100, s.valor_previsto * 0.05));
  // Um ciclo só conta como "em falta" passados 7 dias (o banco pode demorar); o pagamento pode chegar até 10 dias antes.
  const firme = cobrancaAnterior(s, somarDias(hoje, -7));
  let estado: EstadoDebito["estado"];
  if (!ultimo) estado = "sem_pagamentos";
  else if (anterior && ultimo.data >= somarDias(anterior, -10)) estado = "pago";
  else if (firme && ultimo.data < somarDias(firme, -10)) estado = "em_falta";
  else estado = "a_seguir";
  return { estado, ultimo, anterior, proxima, diferente, faltaDe: estado === "em_falta" ? firme : null };
}

/** Quanto já saiu este mês em débitos (movimentos ligados a um débito, no mês de `hoje`). */
export function saidoEsteMes(movimentos: Movimento[], hoje: string): number {
  const mes = hoje.slice(0, 7);
  return movimentos.filter((m) => m.subscricao_id && m.valor < 0 && m.data.startsWith(mes)).reduce((x, m) => x - m.valor, 0);
}
