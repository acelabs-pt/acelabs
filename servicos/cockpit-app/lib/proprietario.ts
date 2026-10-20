import { sbBrowser } from "@/lib/supabase-browser";

export type EstadoProprietario =
  | "fsbo"
  | "reuniao_marcada"
  | "reuniao_angariacao"
  | "dossier_enviado"
  | "imovel_vendido_enviado"
  | "follow_up_1"
  | "follow_up_2"
  | "angariado"
  | "perdido";

// Funil do desenho. "perdido" fica fora do funil.
export const FUNIL_PROP: { id: EstadoProprietario; label: string }[] = [
  { id: "fsbo", label: "FSBO" },
  { id: "reuniao_marcada", label: "Marcação de reunião" },
  { id: "reuniao_angariacao", label: "Reunião de angariação" },
  { id: "dossier_enviado", label: "Dossier + Instagram" },
  { id: "imovel_vendido_enviado", label: "Imóvel vendido" },
  { id: "follow_up_1", label: "Chamada follow up 1" },
  { id: "follow_up_2", label: "Chamada follow up 2" },
  { id: "angariado", label: "Angariado" },
];

export function labelEstadoProp(e: EstadoProprietario): string {
  return e === "perdido" ? "Perdido" : FUNIL_PROP.find((f) => f.id === e)!.label;
}

export function indiceFunilProp(e: EstadoProprietario): number {
  return FUNIL_PROP.findIndex((f) => f.id === e);
}

export type Proprietario = {
  id: string;
  contacto_id: string;
  link_imovel: string | null;
  tipo_imovel: string | null;
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
  tipologia: string | null;
  valor: number | null;
  estado: EstadoProprietario;
  estado_desde: string;
  reuniao_em: string | null;
  contactos: {
    id: string;
    nome: string;
    telemovel: string | null;
    email: string | null;
    canal_origem: string | null;
    observacoes: string | null;
  };
};

export type Chamada = { id: string; ocorreu_em: string; observacoes: string | null };

const H = 3600_000;
const D = 24 * H;

// Calendário de follow-ups do desenho, todos relativos à data/hora da reunião de angariação.
function plano(nome: string, reuniao: Date) {
  const em = (ms: number) => new Date(reuniao.getTime() + ms);
  return [
    { k: "reuniao", tipo: "evento", quando: reuniao, titulo: `Reunião de angariação: ${nome}` },
    { k: "aviso", tipo: "tarefa", quando: em(-2 * H), titulo: `Daqui a 2 horas: reunião de angariação com ${nome}` },
    { k: "agradecimento", tipo: "tarefa", quando: em(2 * H), titulo: `Mensagem de agradecimento a ${nome}` },
    { k: "dossier", tipo: "tarefa", quando: em(2 * D), titulo: `Enviar Dossier Digital + página de Instagram a ${nome}` },
    { k: "vendido", tipo: "tarefa", quando: em(7 * D), titulo: `Partilhar um imóvel vendido com ${nome} (exemplo, de forma natural)` },
    { k: "fu1", tipo: "tarefa", quando: em(14 * D), titulo: `Chamada a ${nome}: ponto de situação da venda por conta própria` },
    { k: "fu2", tipo: "tarefa", quando: em(22 * D), titulo: `Chamada a ${nome}: ponto de situação da venda por conta própria` },
    { k: "angariar", tipo: "tarefa", quando: em(30 * D), titulo: `Chamada de angariação a ${nome}: fechar angariação` },
  ];
}

const chave = (propId: string, k: string) => `proprietario:${propId}:${k}`;

/**
 * Cria (ou reagenda, se a reunião mudou) todas as tarefas do plano de follow-up.
 * As já concluídas não são mexidas. Idempotente graças à chave_automacao.
 */
export async function agendarFollowUps(
  p: { id: string; contacto_id: string; nome: string },
  reuniao: Date
): Promise<void> {
  const sb = sbBrowser();
  const itens = plano(p.nome, reuniao);
  const { data: existentes } = await sb
    .from("tarefas")
    .select("id, chave_automacao, feita")
    .in("chave_automacao", itens.map((i) => chave(p.id, i.k)));
  const porChave = new Map((existentes ?? []).map((e) => [e.chave_automacao, e]));

  const novas = [];
  for (const i of itens) {
    const ex = porChave.get(chave(p.id, i.k));
    if (!ex) {
      novas.push({
        titulo: i.titulo,
        tipo: i.tipo,
        inicio: i.quando.toISOString(),
        origem: "proprietario",
        proprietario_id: p.id,
        contacto_id: p.contacto_id,
        chave_automacao: chave(p.id, i.k),
      });
    } else if (!ex.feita) {
      await sb.from("tarefas").update({ inicio: i.quando.toISOString(), titulo: i.titulo }).eq("id", ex.id);
    }
  }
  if (novas.length > 0) await sb.from("tarefas").insert(novas);
}

// Ao avançar no funil, as tarefas dessa fase ficam como feitas.
const TAREFAS_POR_ESTADO: Partial<Record<EstadoProprietario, string[]>> = {
  reuniao_angariacao: ["aviso", "reuniao"],
  dossier_enviado: ["dossier"],
  imovel_vendido_enviado: ["vendido"],
  follow_up_1: ["fu1"],
  follow_up_2: ["fu2"],
  angariado: ["angariar"],
};

export async function concluirTarefasDaFase(propId: string, estado: EstadoProprietario): Promise<void> {
  const ks = TAREFAS_POR_ESTADO[estado];
  if (!ks) return;
  await sbBrowser()
    .from("tarefas")
    .update({ feita: true, feita_em: new Date().toISOString() })
    .in("chave_automacao", ks.map((k) => chave(propId, k)))
    .eq("feita", false);
}

// Ao marcar uma tarefa como feita, o proprietário avança para esta fase do funil.
// "aviso" e "agradecimento" não têm fase própria (acontecem dentro da reunião).
export const ESTADO_POR_TAREFA: Record<string, EstadoProprietario> = {
  reuniao: "reuniao_angariacao",
  dossier: "dossier_enviado",
  vendido: "imovel_vendido_enviado",
  fu1: "follow_up_1",
  fu2: "follow_up_2",
  angariar: "angariado",
};

// "proprietario:<id>:<k>" -> k
export function tipoDaTarefa(chave: string | null): string | null {
  const partes = chave?.split(":");
  return partes && partes[0] === "proprietario" ? partes[2] ?? null : null;
}
