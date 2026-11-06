// Tesouraria: quanto dinheiro há hoje, o que vai entrar e sair nos próximos dias, e quanto tempo dura. Sem rede, testado em
// testes/unidade.ts. É uma estimativa: usa o que já se sabe (débitos diretos, faturas por pagar e por receber, contratos).

import { custoMensal, proximaCobranca, somarDias } from "./calculos";
import type { Categoria, Conta, Contrato, Entidade, Fatura, Movimento, Subscricao } from "./tipos";

export type OrigemEvento = "debito" | "contrato" | "a_receber" | "a_pagar";
export type Evento = { data: string; valor: number; origem: OrigemEvento; texto: string };

const ULTIMO_DIA = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** As datas em que uma coisa mensal cai entre `de` e `ate` (inclusive), no dia pedido (ou no último do mês, se não houver). */
export function datasMensais(dia: number, de: string, ate: string, inicio?: string, fim?: string | null): string[] {
  const r: string[] = [];
  const [a0, m0] = de.split("-").map(Number);
  for (let i = 0; i < 40; i++) {
    const total = a0 * 12 + (m0 - 1) + i;
    const ano = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const d = `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ULTIMO_DIA(ano, mes))).padStart(2, "0")}`;
    if (d > ate) break;
    if (d < de) continue;
    if (inicio && d < inicio) continue;
    if (fim && d > fim) continue;
    r.push(d);
  }
  return r;
}

/** Mensalidade recorrente (MRR): soma das mensalidades dos contratos ativos em `hoje`. */
export function mrr(contratos: Contrato[], hoje: string): number {
  return contratos.filter((c) => c.estado === "ativo" && c.inicio <= hoje && (!c.fim || c.fim >= hoje)).reduce((x, c) => x + c.mensalidade, 0);
}

/** Tudo o que se espera que entre e saia da conta da empresa nos próximos `dias` dias, por ordem de data. */
export function eventosFuturos(o: {
  hoje: string;
  dias: number;
  subscricoes: Subscricao[];
  contas: Conta[];
  faturas: Fatura[];
  contratos: Contrato[];
  entidades: Entidade[];
}): Evento[] {
  const ate = somarDias(o.hoje, o.dias);
  const ev: Evento[] = [];
  const daEmpresa = new Set(o.contas.filter((c) => c.tipo === "empresa" || (c.tipo === "cartao" && !c.titular)).map((c) => c.id));
  const nome = new Map(o.entidades.map((e) => [e.id, e.nome]));

  // 1. Débitos diretos e subscrições que saem da conta da empresa (as dos sócios entram nas dívidas aos sócios).
  const comDebito = new Set<string>();
  for (const s of o.subscricoes) {
    if (!s.ativa || !s.valor_previsto || (s.conta_id && !daEmpresa.has(s.conta_id))) continue;
    if (s.entidade_id) comDebito.add(s.entidade_id);
    let d = proximaCobranca(s, o.hoje);
    for (let i = 0; i < 60 && d <= ate; i++) {
      ev.push({ data: d, valor: -s.valor_previsto, origem: "debito", texto: s.nome });
      d = proximaCobranca(s, somarDias(d, 1));
    }
  }

  // 2. Mensalidades e arranques dos contratos.
  for (const c of o.contratos) {
    if (c.estado !== "ativo") continue;
    const cliente = nome.get(c.entidade_id) ?? "Cliente";
    if (c.setup > 0 && c.inicio >= o.hoje && c.inicio <= ate) ev.push({ data: c.inicio, valor: c.setup, origem: "contrato", texto: `${cliente}: arranque` });
    if (c.mensalidade > 0) for (const d of datasMensais(c.dia, o.hoje, ate, c.inicio, c.fim)) ev.push({ data: d, valor: c.mensalidade, origem: "contrato", texto: `${cliente}: mensalidade` });
  }

  // 3. Faturas ainda sem movimento no banco: por receber (emitidas) e por pagar (recebidas). As de fornecedores que já têm
  //    débito direto não se contam outra vez. Sem vencimento assume-se 30 dias depois da fatura; as vencidas contam para hoje.
  for (const f of o.faturas) {
    if (f.estado === "anulada" || f.movimento_id) continue;
    const valor = f.moeda === "EUR" ? f.total : f.total_eur;
    if (!valor) continue;
    const emitida = f.sentido === "emitida";
    if (!emitida && f.entidade_id && comDebito.has(f.entidade_id)) continue;
    const quando = f.vencimento ?? somarDias(f.data ?? o.hoje, 30);
    const data = quando < o.hoje ? o.hoje : quando;
    if (data > ate) continue;
    ev.push({ data, valor: emitida ? Math.abs(valor) : -Math.abs(valor), origem: emitida ? "a_receber" : "a_pagar", texto: f.emitente_nome || f.numero || "Fatura" });
  }
  return ev.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : b.valor - a.valor));
}

export type Ponto = { dia: string; saldo: number };

/** O saldo de cada dia: começa no caixa de hoje e aplica os eventos pela ordem das datas. */
export function preverCaixa(caixa: number, eventos: Evento[], hoje: string, dias: number): Ponto[] {
  const porDia = new Map<string, number>();
  for (const e of eventos) porDia.set(e.data, (porDia.get(e.data) ?? 0) + e.valor);
  const r: Ponto[] = [];
  let saldo = caixa;
  for (let i = 0; i <= dias; i++) {
    const dia = somarDias(hoje, i);
    saldo += porDia.get(dia) ?? 0;
    r.push({ dia, saldo });
  }
  return r;
}

/** Saída média por mês nos últimos `meses` meses fechados (custos reais pelos movimentos; transferências e capital não contam). */
export function saidaMensalMedia(movimentos: Movimento[], categorias: Categoria[], hoje: string, meses = 3): number {
  const interno = new Set(categorias.filter((c) => c.tipo === "interno").map((c) => c.id));
  const [a, m] = hoje.split("-").map(Number);
  const fim = new Date(Date.UTC(a, m - 1, 1)); // primeiro dia do mês atual (exclusivo)
  const inicio = new Date(Date.UTC(a, m - 1 - meses, 1));
  const de = inicio.toISOString().slice(0, 10);
  const ate = fim.toISOString().slice(0, 10);
  let total = 0;
  for (const mv of movimentos) {
    if (mv.valor >= 0 || mv.data < de || mv.data >= ate) continue;
    if (mv.categoria_id && interno.has(mv.categoria_id)) continue;
    total += -mv.valor;
  }
  return Math.round(total / meses);
}

/**
 * Quantos meses dura o dinheiro: caixa a dividir pela saída mensal líquida (saída média menos a mensalidade que entra).
 * Devolve null se a empresa já se sustenta (a entrada cobre a saída) ou se não há saídas para comparar.
 */
export function autonomiaEmMeses(caixa: number, saidaMensal: number, entradaMensal: number): number | null {
  const liquida = saidaMensal - entradaMensal;
  if (saidaMensal <= 0 || liquida <= 0) return null;
  return Math.max(0, Math.round((caixa / liquida) * 10) / 10);
}

/** O ponto mais baixo da previsão (para avisar se o caixa vai ao negativo). */
export function pontoMaisBaixo(pontos: Ponto[]): Ponto {
  return pontos.reduce((m, p) => (p.saldo < m.saldo ? p : m), pontos[0]);
}

/** Custo mensal fixo dos débitos ativos da empresa (para mostrar ao lado da autonomia). */
export function fixosMensais(subs: Subscricao[], contas: Conta[]): number {
  const daEmpresa = new Set(contas.filter((c) => c.tipo === "empresa" || (c.tipo === "cartao" && !c.titular)).map((c) => c.id));
  return subs.filter((s) => s.ativa && (!s.conta_id || daEmpresa.has(s.conta_id))).reduce((x, s) => x + custoMensal(s), 0);
}

/** Faturas emitidas por receber, as vencidas primeiro. */
export function porReceber(faturas: Fatura[], hoje: string): { fatura: Fatura; atraso: number }[] {
  return faturas
    .filter((f) => f.sentido === "emitida" && f.estado !== "anulada" && !f.movimento_id && (f.moeda === "EUR" ? f.total : f.total_eur))
    .map((f) => {
      const v = f.vencimento ?? somarDias(f.data ?? hoje, 30);
      return { fatura: f, atraso: Math.round((Date.parse(hoje) - Date.parse(v)) / 86_400_000) };
    })
    .sort((a, b) => b.atraso - a.atraso);
}
