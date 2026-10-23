import { sbBrowser } from "@/lib/supabase-browser";
import { alertaLaranja, type Comprador, type ImovelComprador } from "@/lib/comprador";
import type { Proprietario } from "@/lib/proprietario";
import { blocoDeDia, dataDoDia, dataLocal, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import type { Tarefa } from "@/lib/types";
import { dentro, limites, type Metas, type Metrica, type Periodo } from "@/lib/metricas";
import { diasAte, diasDesde, semanaISO } from "@/lib/datas";
import { todas } from "@/lib/todas";

export type Dados = {
  compradores: Comprador[];
  imoveis: ImovelComprador[];
  proprietarios: Proprietario[];
  angariacoes: Angariacao[];
  acoes: Acao[];
  tarefas: Tarefa[];
  metas: Metas;
  decisaoSemana: "colocada" | "ignorada" | null;
};

export const SEM_METAS = (ano: number): Metas => ({
  ano,
  semanasUteis: 52,
  faturacaoAnual: null,
  anual: { visitas: null, reunioes_angariacao: null, angariacoes: null, transacoes: null },
  visitasPorTransacao: null,
  reunioesPorAngariacao: null,
});

export async function carregarDados(agora: Date = new Date()): Promise<Dados | string> {
  const sb = sbBrowser();
  const ano = agora.getFullYear();
  const semana = semanaISO(agora);
  const [c, i, p, a, ac, t, m, cfg, sem] = await Promise.all([
    todas((de, ate) => sb.from("compradores").select("*, contactos(*)").order("id").range(de, ate)),
    todas((de, ate) => sb.from("comprador_imoveis").select("*").order("id").range(de, ate)),
    todas((de, ate) => sb.from("proprietarios").select("*, contactos(*)").order("id").range(de, ate)),
    todas((de, ate) => sb.from("angariacoes").select("*, proprietarios(contactos(nome))").order("id").range(de, ate)),
    todas((de, ate) => sb.from("angariacao_acoes").select("*").order("id").range(de, ate)),
    todas((de, ate) => sb.from("tarefas").select("*").order("id").range(de, ate)),
    sb.from("metas").select("*").eq("ano", ano),
    sb.from("metas_config").select("*").eq("ano", ano),
    sb.from("metas_semanas").select("*").eq("semana", semana),
  ]);
  const falhou = [c, i, p, a, ac, t, m, cfg, sem].find((r) => r.error);
  if (falhou) return "Não foi possível carregar o Dashboard.";

  const metas = SEM_METAS(ano);
  for (const r of m.data ?? []) {
    metas.anual[r.metrica as Metrica] = r.valor_anual > 0 ? r.valor_anual : null;
    if (r.metrica === "visitas") metas.visitasPorTransacao = r.taxa_conversao;
    if (r.metrica === "reunioes_angariacao") metas.reunioesPorAngariacao = r.taxa_conversao;
  }
  if (cfg.data?.[0]) {
    metas.semanasUteis = cfg.data[0].semanas_uteis;
    metas.faturacaoAnual = cfg.data[0].faturacao_anual > 0 ? Number(cfg.data[0].faturacao_anual) : null;
  }

  return {
    compradores: (c.data ?? []) as unknown as Comprador[],
    imoveis: (i.data ?? []) as ImovelComprador[],
    proprietarios: (p.data ?? []) as unknown as Proprietario[],
    angariacoes: (a.data ?? []) as unknown as Angariacao[],
    acoes: (ac.data ?? []) as Acao[],
    tarefas: ((t.data ?? []) as Tarefa[]).filter((x) => x.no_calendario),
    metas,
    decisaoSemana: (sem.data?.[0]?.decisao as "colocada" | "ignorada") ?? null,
  };
}

export type Feitos = Record<Metrica, number> & { transCompradores: number; transAngariacoes: number; faturado: number };

/** Quanto foi feito em cada métrica no período (contagens diretas dos dados, sem estimativas). */
export function feitos(d: Dados, p: Periodo, agora: Date = new Date()): Feitos {
  const l = limites(p, agora);
  const visitas = d.imoveis.filter((i) => i.visitado_em && dentro(dataLocal(i.visitado_em), l)).length;
  const reunioes = d.proprietarios.filter((x) => {
    if (!x.reuniao_em) return false;
    const q = new Date(x.reuniao_em);
    return q <= agora && dentro(q, l);
  }).length;
  const angariacoes = d.angariacoes.filter((a) => dentro(dataLocal(a.inicio), l)).length;
  // Transação = escritura feita (comprador concluído) OU imóvel angariado vendido
  // A transação conta no CPCV (comprador) ou quando o imóvel é dado como vendido (angariação).
  const transCompradores = d.compradores.filter((c) => c.cpcv_fechado && c.cpcv_data && dentro(dataLocal(c.cpcv_data), l)).length;
  const transAngariacoes = d.angariacoes.filter((a) => a.vendido_em && dentro(dataLocal(a.vendido_em), l)).length;
  // A faturação só conta a comissão quando está recebida (na data de receção)
  const recebidasC = d.compradores.filter((c) => c.comissao_recebida && c.comissao_recebida_em && dentro(dataLocal(c.comissao_recebida_em), l));
  const recebidasA = d.angariacoes.filter((a) => a.comissao_recebida && a.comissao_recebida_em && dentro(dataLocal(a.comissao_recebida_em), l));
  const faturado = [...recebidasC, ...recebidasA].reduce((s, x) => s + Number(x.comissao_valor ?? 0), 0);
  return {
    visitas,
    reunioes_angariacao: reunioes,
    angariacoes,
    transacoes: transCompradores + transAngariacoes,
    transCompradores,
    transAngariacoes,
    faturado,
  };
}

export function pipeline(d: Dados) {
  const emPropostas = d.compradores.filter((c) => c.estado === "propostas_efetuadas");
  const ids = new Set(emPropostas.map((c) => c.id));
  const nPropostas = d.imoveis.filter((i) => i.proposta_em && ids.has(i.comprador_id)).length;
  const comCpcv = d.compradores.filter((c) => c.estado === "cpcv" || c.estado === "escritura");
  const escrituras = comCpcv.slice().sort((a, b) => (a.escritura_prazo ?? "9999").localeCompare(b.escritura_prazo ?? "9999"));
  return {
    nPropostas,
    compradoresEmPropostas: emPropostas.length,
    cpcvFechados: comCpcv.length,
    escrituras,
    escriturasAgendadas: comCpcv.filter((c) => c.escritura_agendada).length,
  };
}

export type Aviso = { id: string; texto: string; href: string; grave: boolean };

/** O que não se pode deixar cair: leads parados, follow ups atrasados, escrituras e contratos a terminar. */
export function avisos(d: Dados, agora: Date = new Date()): Aviso[] {
  const out: Aviso[] = [];
  for (const c of d.compradores) {
    const al = alertaLaranja(c);
    if (al) out.push({ id: `c-${c.id}`, texto: `${c.contactos.nome}: ${al}`, href: `/crm/compradores/${c.id}`, grave: false });
    if ((c.estado === "cpcv" || c.estado === "escritura") && c.escritura_prazo) {
      const dias = diasAte(c.escritura_prazo);
      if (dias <= 15)
        out.push({
          id: `e-${c.id}`,
          texto: dias < 0 ? `${c.contactos.nome}: prazo da escritura ultrapassado há ${-dias} dias` : `${c.contactos.nome}: escritura em ${dias} dias`,
          href: `/crm/compradores/${c.id}`,
          grave: dias <= 7,
        });
    }
  }
  for (const p of d.proprietarios) {
    if (p.estado === "perdido" || p.estado === "angariado") continue;
    const atrasadas = d.tarefas.filter((t) => t.proprietario_id === p.id && !t.feita && t.inicio && new Date(t.inicio) < agora);
    if (atrasadas.length)
      out.push({ id: `p-${p.id}`, texto: `${p.contactos.nome}: ${atrasadas.length} ${atrasadas.length === 1 ? "follow up em atraso" : "follow ups em atraso"}`, href: `/crm/proprietarios/${p.id}`, grave: false });
  }
  for (const a of d.angariacoes) {
    if (a.vendido_em) continue;
    const dia = diaDeHoje(a.inicio);
    if (dia < 1) continue;
    const acoes = d.acoes.filter((x) => x.angariacao_id === a.id);
    const restam = a.duracao_dias - dia + 1;
    if (restam >= 0 && restam <= 30) out.push({ id: `a-${a.id}`, texto: `${a.titulo}: contrato termina em ${restam} dias`, href: `/angariacoes/${a.id}`, grave: restam <= 10 });
    const emAtraso = acoes.filter((x) => !x.feita && dataDoDia(a.inicio, blocoDeDia(x.dia) * 10) < agora).length;
    if (emAtraso) out.push({ id: `aa-${a.id}`, texto: `${a.titulo}: ${emAtraso} ${emAtraso === 1 ? "ação do plano em atraso" : "ações do plano em atraso"}`, href: `/angariacoes/${a.id}`, grave: false });
  }
  return out.sort((x, y) => Number(y.grave) - Number(x.grave));
}

/** Comissões recebidas, acumuladas no fim de cada mês do ano. Meses futuros ficam a null. */
export function faturacaoAcumulada(d: Dados, ano: number, agora: Date = new Date()): { meses: (number | null)[]; mesAtual: number } {
  const mesAtual = agora.getFullYear() === ano ? agora.getMonth() : agora.getFullYear() > ano ? 11 : -1;
  const porMes = Array<number>(12).fill(0);
  for (const x of [...d.compradores, ...d.angariacoes]) {
    if (!x.comissao_recebida || !x.comissao_recebida_em) continue;
    const dt = dataLocal(x.comissao_recebida_em);
    if (dt.getFullYear() === ano) porMes[dt.getMonth()] += Number(x.comissao_valor ?? 0);
  }
  let acc = 0;
  return { meses: porMes.map((v, i) => ((acc += v), i <= mesAtual ? acc : null)), mesAtual };
}

export type FaixaComissao = { rot: string; valor: number; n: number };

/**
 * Comissões ainda por receber de compradores com CPCV ou escritura, por horizonte (dias até à escritura).
 * Usa a data da escritura, ou o prazo se não houver data. Negócios sem valor de comissão contam à parte.
 */
export function comissaoPrevista(d: Dados): { faixas: FaixaComissao[]; total: number; semValor: number; semData: number } {
  const faixas: FaixaComissao[] = [
    { rot: "Até 30 dias", valor: 0, n: 0 },
    { rot: "31 a 60 dias", valor: 0, n: 0 },
    { rot: "61 a 90 dias", valor: 0, n: 0 },
    { rot: "Mais tarde ou sem data", valor: 0, n: 0 },
  ];
  let semValor = 0;
  let semData = 0;
  for (const c of d.compradores) {
    if (!(c.estado === "cpcv" || c.estado === "escritura") || c.comissao_recebida) continue;
    const valor = Number(c.comissao_valor ?? 0);
    if (!(valor > 0)) {
      semValor++;
      continue;
    }
    const data = c.escritura_data ?? c.escritura_prazo;
    if (!data) semData++;
    const dias = data ? diasAte(data) : Infinity;
    const f = dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3;
    faixas[f].valor += valor;
    faixas[f].n++;
  }
  return { faixas, total: faixas.reduce((s, f) => s + f.valor, 0), semValor, semData };
}

export type EtapaFunil = {
  id: string;
  label: string;
  /** Quantos estão nesta fase agora. */
  aqui: number;
  /** Quantos chegaram pelo menos a esta fase (os perdidos não entram: não se sabe onde caíram). */
  chegaram: number;
  /** Percentagem dos que chegaram à fase anterior e passaram a esta. Null na primeira. */
  passagem: number | null;
  /** Média de dias parados na fase, de quem está nela agora. Null se ninguém. */
  diasParados: number | null;
};

/** Funil com taxa de passagem entre fases e tempo parado. `ordem` é a ordem das fases, da primeira à última. */
export function funilComConversao(
  ordem: { id: string; label: string }[],
  itens: { estado: string; estado_desde: string }[]
): { etapas: EtapaFunil[]; perdidos: number } {
  const indice = (e: string) => ordem.findIndex((o) => o.id === e);
  const ativos = itens.filter((x) => x.estado !== "perdido" && indice(x.estado) >= 0);
  const etapas: EtapaFunil[] = ordem.map((o, i) => {
    const aqui = ativos.filter((x) => x.estado === o.id);
    const chegaram = ativos.filter((x) => indice(x.estado) >= i).length;
    return {
      id: o.id,
      label: o.label,
      aqui: aqui.length,
      chegaram,
      passagem: null,
      diasParados: aqui.length ? Math.round(aqui.reduce((s, x) => s + diasDesde(x.estado_desde), 0) / aqui.length) : null,
    };
  });
  for (let i = 1; i < etapas.length; i++) {
    etapas[i].passagem = etapas[i - 1].chegaram > 0 ? Math.round((etapas[i].chegaram / etapas[i - 1].chegaram) * 100) : null;
  }
  return { etapas, perdidos: itens.filter((x) => x.estado === "perdido").length };
}

export type Origem = { canal: string; contactos: number; fechados: number };

/** Contactos por canal de origem e quantos chegaram a negócio (CPCV ou escritura do comprador, imóvel angariado do proprietário). */
export function origens(d: Dados): Origem[] {
  const por = new Map<string, Origem>();
  const ponto = (canal: string | null) => {
    const k = canal?.trim() || "Sem canal";
    if (!por.has(k)) por.set(k, { canal: k, contactos: 0, fechados: 0 });
    return por.get(k)!;
  };
  for (const c of d.compradores) {
    const o = ponto(c.contactos.canal_origem);
    o.contactos++;
    if (c.cpcv_fechado || c.estado === "cpcv" || c.estado === "escritura" || c.estado === "negocio_concluido") o.fechados++;
  }
  for (const p of d.proprietarios) {
    const o = ponto(p.contactos.canal_origem);
    o.contactos++;
    if (p.estado === "angariado") o.fechados++;
  }
  return [...por.values()].sort((a, b) => b.contactos - a.contactos);
}
