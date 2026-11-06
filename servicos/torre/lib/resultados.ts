// Resultados (proveitos e custos por mês), pelos movimentos do banco. Quando o movimento tem fatura em EUR com base e
// IVA, conta só a base (sem IVA) e o IVA vai para a linha do IVA, como na contabilidade. Sem fatura conta o valor todo.
// Movimentos internos (transferências, capital, suprimentos, reembolsos, entrega de IVA) não entram.

import type { Categoria, Fatura, Movimento } from "./tipos";

export type LinhaResultado = { chave: string; nome: string; tipo: "proveito" | "custo"; porMes: Record<string, number>; total: number };

export type Resultados = {
  meses: string[];
  grupos: LinhaResultado[];
  proveitos: Record<string, number>;
  custos: Record<string, number>;
  resultado: Record<string, number>;
  /** IVA pago nas faturas recebidas (dedutível) e cobrado nas emitidas (a entregar), por mês. Estimativa. */
  ivaDedutivel: Record<string, number>;
  ivaLiquidado: Record<string, number>;
  porClassificar: Record<string, number>;
};

export function calcularResultados(movimentos: Movimento[], faturas: Fatura[], categorias: Categoria[], meses: string[]): Resultados {
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const faturaDe = new Map(faturas.filter((f) => f.movimento_id && f.estado !== "anulada").map((f) => [f.movimento_id!, f]));
  const zero = () => Object.fromEntries(meses.map((m) => [m, 0])) as Record<string, number>;
  const r: Resultados = { meses, grupos: [], proveitos: zero(), custos: zero(), resultado: zero(), ivaDedutivel: zero(), ivaLiquidado: zero(), porClassificar: zero() };
  const grupos = new Map<string, LinhaResultado>();
  const dentro = new Set(meses);

  for (const m of movimentos) {
    const mes = m.data.slice(0, 7);
    if (!dentro.has(mes)) continue;
    const c = m.categoria_id ? cat.get(m.categoria_id) : null;
    if (!c) {
      r.porClassificar[mes] += m.valor;
      continue;
    }
    if (c.tipo === "interno") continue;
    let valor = m.valor;
    const f = faturaDe.get(m.id);
    if (f && f.moeda === "EUR" && f.iva && f.total && Math.abs(Math.abs(f.total) - Math.abs(m.valor)) <= 2) {
      const iva = Math.sign(m.valor) * Math.abs(f.iva);
      valor = m.valor - iva;
      if (iva < 0) r.ivaDedutivel[mes] += -iva;
      else r.ivaLiquidado[mes] += iva;
    }
    const chave = `${c.tipo}:${c.grupo}`;
    const g = grupos.get(chave) ?? { chave, nome: c.grupo, tipo: c.tipo, porMes: zero(), total: 0 };
    // Custos guardam-se positivos (um estorno num custo reduz o custo).
    const v = c.tipo === "custo" ? -valor : valor;
    g.porMes[mes] += v;
    g.total += v;
    grupos.set(chave, g);
    if (c.tipo === "custo") r.custos[mes] += v;
    else r.proveitos[mes] += v;
  }
  for (const mes of meses) r.resultado[mes] = r.proveitos[mes] - r.custos[mes];
  r.grupos = [...grupos.values()].sort((a, b) => (a.tipo === b.tipo ? b.total - a.total : a.tipo === "proveito" ? -1 : 1));
  return r;
}

export type LinhaIva = { trimestre: string; liquidado: number; dedutivel: number; /** Positivo = a entregar às Finanças; negativo = a recuperar. */ saldo: number };

/** IVA somado por trimestre civil (T1 = jan a mar). Só trimestres com algum IVA. Estimativa pelas faturas ligadas a movimentos. */
export function ivaPorTrimestre(r: Pick<Resultados, "meses" | "ivaLiquidado" | "ivaDedutivel">): LinhaIva[] {
  const t = new Map<string, LinhaIva>();
  for (const m of r.meses) {
    const [a, mes] = m.split("-").map(Number);
    const chave = `${a} T${Math.ceil(mes / 3)}`;
    const l = t.get(chave) ?? { trimestre: chave, liquidado: 0, dedutivel: 0, saldo: 0 };
    l.liquidado += r.ivaLiquidado[m] ?? 0;
    l.dedutivel += r.ivaDedutivel[m] ?? 0;
    t.set(chave, l);
  }
  return [...t.values()].filter((l) => l.liquidado || l.dedutivel).map((l) => ({ ...l, saldo: l.liquidado - l.dedutivel }));
}

/** Os últimos n meses até `ate` (inclusive), do mais antigo para o mais recente. */
export function ultimosMeses(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
