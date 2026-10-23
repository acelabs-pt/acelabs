import { sbBrowser } from "@/lib/supabase-browser";
import { inicioDoDia, somarDias } from "@/lib/datas";

export type Angariacao = {
  id: string;
  proprietario_id: string | null;
  titulo: string;
  duracao_dias: 120 | 180;
  regime: "exclusivo" | "nao_exclusivo" | null;
  inicio: string; // YYYY-MM-DD
  vendido_em: string | null;
  valor_negocio: number | null;
  comissao_valor: number | null;
  comissao_recebida: boolean;
  comissao_recebida_em: string | null;
  tipo_imovel: string | null;
  tipologia: string | null;
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
  valor: number | null;
  proprietarios: { contactos: { nome: string } } | null;
};

export type Acao = {
  id: string;
  angariacao_id: string;
  nome: string;
  dia: number; // 0..duracao; o bloco de 10 dias é floor(dia / 10) + 1
  follow_up: boolean;
  feita: boolean;
  feita_em: string | null;
  feedback: string | null;
};

export const NOME_FOLLOW_UP = "Follow up";
export const DIAS_POR_BLOCO = 10;

/**
 * Ações do desenho "Gestor de Angariações". Cada número é o bloco de 10 dias (1 a 18)
 * onde o desenho coloca a checkbox da ação (medido sobre a imagem do desenho).
 */
export const ACOES_PADRAO: { nome: string; blocos: number[] }[] = [
  { nome: "Fotografias/Vídeo", blocos: [1] },
  { nome: "Placa de Venda", blocos: [1] },
  { nome: "Inserção Portais/Site", blocos: [1, 2, 3] },
  { nome: "Propostas Múltiplas", blocos: [1, 2, 4, 5, 9, 10, 15, 16] },
  { nome: "Distribuição Flyers", blocos: [2, 8, 14] },
  { nome: "Newsletter Base de Dados", blocos: [2, 6, 9, 12, 16] },
  { nome: "Campanha Social Media", blocos: [2, 5, 8, 11, 14, 17] },
  { nome: "Campanha META", blocos: [2, 5, 12, 16] },
  { nome: "Newsletter Agências", blocos: [2, 6, 9, 12, 16] },
  { nome: "Open House", blocos: [2, 9] },
  { nome: "Refresh do Anúncio", blocos: [3, 6, 9, 12, 15, 17] },
  { nome: "Parceria negócios na zona", blocos: [2, 8, 14] },
];

// Bandeiras vermelhas (follow ups ao proprietário) do desenho: a meio destes blocos.
export const FOLLOW_UP_BLOCOS = [2, 3, 5, 6, 8, 9, 10, 12, 14, 15, 16, 17];

export const blocoDeDia = (dia: number) => Math.floor(dia / DIAS_POR_BLOCO) + 1;
export const diaInicioBloco = (bloco: number) => (bloco - 1) * DIAS_POR_BLOCO;
const diaMeioBloco = (bloco: number) => diaInicioBloco(bloco) + 5;

export const nBlocos = (duracao: number) => duracao / DIAS_POR_BLOCO;

export function dataLocal(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

// Data de calendário de um dia do contrato (dia 0 = início do contrato)
export function dataDoDia(inicio: string, dia: number): Date {
  return somarDias(dataLocal(inicio), dia);
}

// Dia do contrato em que estamos hoje (1 = primeiro dia)
export function diaDeHoje(inicio: string): number {
  return Math.round((inicioDoDia(new Date()).getTime() - dataLocal(inicio).getTime()) / 86400000) + 1;
}

export function blocoAtual(inicio: string, duracao: number): number | null {
  const d = diaDeHoje(inicio);
  if (d < 1 || d > duracao) return null;
  return Math.ceil(d / DIAS_POR_BLOCO);
}

type Linha = { nome: string; dia: number; follow_up: boolean };

export type AcaoExtra = { nome: string; bloco: number };

export function linhasDoPlano(
  nomes: string[],
  incluirFollowUps: boolean,
  duracao: number,
  extras: AcaoExtra[] = []
): Linha[] {
  const max = nBlocos(duracao);
  const linhas: Linha[] = [];
  for (const a of ACOES_PADRAO) {
    if (!nomes.includes(a.nome)) continue;
    for (const b of a.blocos) if (b <= max) linhas.push({ nome: a.nome, dia: diaInicioBloco(b), follow_up: false });
  }
  if (incluirFollowUps) {
    for (const b of FOLLOW_UP_BLOCOS) if (b <= max) linhas.push({ nome: NOME_FOLLOW_UP, dia: diaMeioBloco(b), follow_up: true });
  }
  // ações acrescentadas pelo consultor antes de criar o plano
  for (const e of extras) if (e.bloco <= max) linhas.push({ nome: e.nome, dia: diaInicioBloco(e.bloco), follow_up: false });
  return linhas;
}

function tarefaDaAcao(a: Acao, ang: Pick<Angariacao, "inicio" | "titulo">) {
  const quando = dataDoDia(ang.inicio, a.dia);
  quando.setHours(9, 0, 0, 0);
  return {
    titulo: a.follow_up ? `Follow up com o proprietário: ${ang.titulo}` : `${a.nome}: ${ang.titulo}`,
    tipo: "tarefa",
    inicio: quando.toISOString(),
    origem: "angariacao",
    angariacao_acao_id: a.id,
    chave_automacao: `angariacao:${a.id}`,
  };
}

/** Cria as ações do plano e as respetivas tarefas no calendário. */
export async function criarPlano(
  ang: Angariacao,
  nomes: string[],
  incluirFollowUps: boolean,
  duracao: 120 | 180,
  extras: AcaoExtra[] = []
): Promise<string | null> {
  const sb = sbBrowser();
  if (duracao !== ang.duracao_dias) {
    const { error } = await sb.from("angariacoes").update({ duracao_dias: duracao }).eq("id", ang.id);
    if (error) return "Não foi possível guardar a duração.";
  }
  const linhas = linhasDoPlano(nomes, incluirFollowUps, duracao, extras);
  if (linhas.length === 0) return "Escolhe pelo menos uma ação.";
  const { data, error } = await sb
    .from("angariacao_acoes")
    .insert(linhas.map((l) => ({ ...l, angariacao_id: ang.id })))
    .select("*");
  if (error || !data) return "Não foi possível criar o plano.";
  const { error: e2 } = await sb.from("tarefas").insert((data as Acao[]).map((a) => tarefaDaAcao(a, ang)));
  return e2 ? "O plano foi criado mas não foi possível pôr as tarefas no calendário." : null;
}

/** Junta uma ação a um bloco (e a tarefa correspondente). */
export async function adicionarAcao(
  ang: Angariacao,
  nome: string,
  bloco: number,
  followUp = false
): Promise<string | null> {
  const sb = sbBrowser();
  const dia = followUp ? diaMeioBloco(bloco) : diaInicioBloco(bloco);
  const { data, error } = await sb
    .from("angariacao_acoes")
    .insert({ angariacao_id: ang.id, nome, dia, follow_up: followUp })
    .select("*")
    .single();
  if (error || !data) return "Não foi possível adicionar a ação.";
  const { error: e2 } = await sb.from("tarefas").insert(tarefaDaAcao(data as Acao, ang));
  return e2 ? "Ação criada, mas sem tarefa no calendário." : null;
}

/** Marca uma ação como feita/por fazer, mantendo a tarefa do calendário em sintonia. */
export async function marcarAcao(a: Acao, feita: boolean): Promise<string | null> {
  const sb = sbBrowser();
  const feita_em = feita ? new Date().toISOString() : null;
  const { error } = await sb.from("angariacao_acoes").update({ feita, feita_em }).eq("id", a.id);
  if (error) return "Não foi possível guardar.";
  await sb.from("tarefas").update({ feita, feita_em }).eq("angariacao_acao_id", a.id);
  return null;
}

/** "Vendido" em qualquer ponto do plano: as tarefas por fazer saem do calendário (reversível). */
export async function marcarVendido(ang: Angariacao, acoes: Acao[], vendidoEm: string | null): Promise<string | null> {
  const sb = sbBrowser();
  const { error } = await sb.from("angariacoes").update({ vendido_em: vendidoEm }).eq("id", ang.id);
  if (error) return "Não foi possível guardar.";
  const ids = acoes.map((a) => a.id);
  if (ids.length > 0) {
    await sb
      .from("tarefas")
      .update({ no_calendario: vendidoEm === null })
      .in("angariacao_acao_id", ids)
      .eq("feita", false);
  }
  return null;
}

/**
 * Muda uma ação para outro dia do contrato (a tarefa do calendário acompanha).
 * A grelha mostra uma ação por linha e bloco, por isso não deixa pôr duas no mesmo bloco.
 */
export async function moverAcao(ang: Angariacao, a: Acao, outras: Acao[], novoDia: number): Promise<string | null> {
  if (novoDia < 0 || novoDia >= ang.duracao_dias) return `Escolhe um dia dentro do contrato (${ang.duracao_dias} dias).`;
  const bloco = blocoDeDia(novoDia);
  if (outras.some((x) => x.id !== a.id && x.nome === a.nome && blocoDeDia(x.dia) === bloco)) {
    return `Já existe "${a.nome}" nesse bloco de 10 dias.`;
  }
  const sb = sbBrowser();
  const { error } = await sb.from("angariacao_acoes").update({ dia: novoDia }).eq("id", a.id);
  if (error) return "Não foi possível mover a ação.";
  const quando = dataDoDia(ang.inicio, novoDia);
  quando.setHours(9, 0, 0, 0);
  await sb.from("tarefas").update({ inicio: quando.toISOString() }).eq("angariacao_acao_id", a.id);
  return null;
}
