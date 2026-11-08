import { sbBrowser } from "@/lib/supabase-browser";
import { alertaLaranja, type Comprador, type ImovelComprador } from "@/lib/comprador";
import type { Proprietario } from "@/lib/proprietario";
import { blocoDeDia, dataDoDia, dataLocal, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import type { Tarefa } from "@/lib/types";
import { dentro, limites, type Metas, type Metrica, type Periodo } from "@/lib/metricas";
import { diasAte, diasDesde, inicioDoDia, semanaISO, somarDias } from "@/lib/datas";
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
  // O Supabase devolve no máximo 1000 linhas por pedido, sem avisar: sem paginar, o Dashboard ficava com tarefas e acções em falta
  // (por exemplo, nenhuma tarefa de compradores). Por isso as tabelas grandes lêem-se por páginas, e das tarefas só se pedem as que
  // o Dashboard usa: por fazer, no calendário e até ao fim desta semana (a semana acaba, no máximo, daqui a 7 dias).
  const limiteTarefas = somarDias(inicioDoDia(agora), 8).toISOString();
  const [c, i, p, a, ac, t, m, cfg, sem] = await Promise.all([
    todas<Comprador>((de, ate) => sb.from("compradores").select("*, contactos(*)").order("id").range(de, ate)),
    todas<ImovelComprador>((de, ate) => sb.from("comprador_imoveis").select("*").order("id").range(de, ate)),
    todas<Proprietario>((de, ate) => sb.from("proprietarios").select("*, contactos(*)").order("id").range(de, ate)),
    todas<Angariacao>((de, ate) => sb.from("angariacoes").select("*, proprietarios(contactos(nome))").order("id").range(de, ate)),
    todas<Acao>((de, ate) => sb.from("angariacao_acoes").select("*").order("id").range(de, ate)),
    todas<Tarefa>((de, ate) =>
      sb.from("tarefas").select("*").eq("feita", false).eq("no_calendario", true).lt("inicio", limiteTarefas).order("id").range(de, ate)
    ),
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
    compradores: c.data,
    imoveis: i.data,
    proprietarios: p.data,
    angariacoes: a.data,
    acoes: ac.data,
    tarefas: t.data,
    metas,
    decisaoSemana: (sem.data?.[0]?.decisao as "colocada" | "ignorada") ?? null,
  };
}

export type Feitos = Record<Metrica, number> & {
  transCompradores: number;
  transAngariacoes: number;
  faturado: number;
  fechadoValor: number; // comissões dos negócios fechados no período, recebidas ou não
};

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
  // Negócios fechados no período (CPCV fechado ou angariação vendida), já pagos ou não
  const fechadosC = d.compradores.filter((c) => c.cpcv_fechado && c.cpcv_data && dentro(dataLocal(c.cpcv_data), l));
  const fechadosA = d.angariacoes.filter((a) => a.vendido_em && dentro(dataLocal(a.vendido_em), l));
  const fechadoValor = [...fechadosC, ...fechadosA].reduce((s, x) => s + Number(x.comissao_valor ?? 0), 0);
  return {
    fechadoValor,
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
    // diz exatamente qual é o passo em atraso (o mais antigo) e, se houver mais, quantos
    const atrasadas = d.tarefas
      .filter((t) => t.proprietario_id === p.id && !t.feita && t.inicio && new Date(t.inicio) < agora)
      .sort((x, y) => x.inicio!.localeCompare(y.inicio!));
    if (atrasadas.length) {
      const dias = Math.max(0, diasDesde(atrasadas[0].inicio!));
      const quando = dias === 0 ? "em atraso desde hoje" : dias === 1 ? "em atraso há 1 dia" : `em atraso há ${dias} dias`;
      const mais = atrasadas.length > 1 ? ` (+ ${atrasadas.length - 1} em atraso)` : "";
      out.push({ id: `p-${p.id}`, texto: `${atrasadas[0].titulo}: ${quando}${mais}`, href: `/crm/proprietarios/${p.id}`, grave: false });
    }
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
