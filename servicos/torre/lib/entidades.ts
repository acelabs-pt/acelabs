// Resumo por cliente e por fornecedor: quanto se pagou ou recebeu, faturas em aberto e contratos. Sem rede, testado.

import { mrr } from "./tesouraria";
import type { Contrato, Entidade, Fatura, Movimento } from "./tipos";

export type ResumoEntidade = {
  entidade: Entidade;
  /** Dinheiro que saiu para esta entidade (movimentos negativos), sempre positivo. */
  pago: number;
  pagoAno: number;
  /** Dinheiro que entrou desta entidade. */
  recebido: number;
  recebidoAno: number;
  nMovimentos: number;
  nFaturas: number;
  /** Faturas ainda sem movimento no banco: valor em euros e quantas (as que não têm o valor em euros ficam só na contagem). */
  emAberto: number;
  nEmAberto: number;
  ultima: string | null;
  contratos: Contrato[];
  /** Mensalidade dos contratos ativos hoje. */
  mrr: number;
};

export function resumirEntidades(entidades: Entidade[], movimentos: Movimento[], faturas: Fatura[], contratos: Contrato[], hoje: string): ResumoEntidade[] {
  const ano = hoje.slice(0, 4);
  const mapa = new Map<string, ResumoEntidade>();
  for (const e of entidades) mapa.set(e.id, { entidade: e, pago: 0, pagoAno: 0, recebido: 0, recebidoAno: 0, nMovimentos: 0, nFaturas: 0, emAberto: 0, nEmAberto: 0, ultima: null, contratos: [], mrr: 0 });
  const toca = (r: ResumoEntidade, data: string | null) => {
    if (data && (!r.ultima || data > r.ultima)) r.ultima = data;
  };
  for (const m of movimentos) {
    const r = m.entidade_id ? mapa.get(m.entidade_id) : undefined;
    if (!r) continue;
    r.nMovimentos++;
    toca(r, m.data);
    if (m.valor < 0) {
      r.pago += -m.valor;
      if (m.data.startsWith(ano)) r.pagoAno += -m.valor;
    } else {
      r.recebido += m.valor;
      if (m.data.startsWith(ano)) r.recebidoAno += m.valor;
    }
  }
  for (const f of faturas) {
    const r = f.entidade_id ? mapa.get(f.entidade_id) : undefined;
    if (!r || f.estado === "anulada") continue;
    r.nFaturas++;
    toca(r, f.data);
    if (!f.movimento_id) {
      r.nEmAberto++;
      r.emAberto += Math.abs((f.moeda === "EUR" ? f.total : f.total_eur) ?? 0);
    }
  }
  for (const c of contratos) {
    const r = mapa.get(c.entidade_id);
    if (r) r.contratos.push(c);
  }
  for (const r of mapa.values()) r.mrr = mrr(r.contratos, hoje);
  return [...mapa.values()];
}
