import { sbBrowser } from "@/lib/supabase-browser";
import { semanaISO, diasDesde } from "@/lib/datas";
import type { Local } from "@/lib/localizacoes";

export type EstadoComprador =
  | "lead_qualificada"
  | "imoveis_enviados"
  | "visitas_realizadas"
  | "propostas_efetuadas"
  | "cpcv"
  | "escritura"
  | "negocio_concluido"
  | "perdido";

// Ordem do funil do desenho. "perdido" fica fora do funil.
export const FUNIL: { id: EstadoComprador; label: string }[] = [
  { id: "lead_qualificada", label: "Lead qualificada" },
  { id: "imoveis_enviados", label: "Imóveis enviados" },
  { id: "visitas_realizadas", label: "Visitas realizadas" },
  { id: "propostas_efetuadas", label: "Propostas efetuadas" },
  { id: "cpcv", label: "CPCV" },
  { id: "escritura", label: "Escritura" },
  { id: "negocio_concluido", label: "Negócio concluído" },
];

export function labelEstado(e: EstadoComprador): string {
  return e === "perdido" ? "Perdido" : FUNIL.find((f) => f.id === e)!.label;
}

export function indiceFunil(e: EstadoComprador): number {
  return FUNIL.findIndex((f) => f.id === e);
}

// Objetivos do desenho: 10 envios, 5 visitas, 3 propostas
export const OBJETIVOS = { enviados: 10, visitas: 5, propostas: 3 } as const;

export type Comprador = {
  id: string;
  contacto_id: string;
  motivacao: number | null;
  referencia_imovel: string | null;
  tipo_imovel: string | null;
  localizacoes: Local[] | null;
  tipologia_minima: string | null;
  expectativa_valor: number | null;
  financiamento: string | null;
  simulacao_credito: string | null;
  precisa_vender: boolean | null;
  estado: EstadoComprador;
  estado_desde: string;
  created_at: string;
  cpcv_fechado: boolean;
  cpcv_data: string | null;
  escritura_agendada: boolean;
  escritura_data: string | null;
  escritura_prazo: string | null;
  valor_negocio: number | null;
  comissao_valor: number | null;
  comissao_recebida: boolean;
  comissao_recebida_em: string | null;
  contactos: {
    id: string;
    nome: string;
    telemovel: string | null;
    email: string | null;
    canal_origem: string | null;
    observacoes: string | null;
  };
};

export type ImovelComprador = {
  id: string;
  comprador_id: string;
  link: string | null;
  descricao: string | null;
  enviado_em: string | null;
  visitado_em: string | null;
  proposta_em: string | null;
};

export type Contagens = { enviados: number; visitas: number; propostas: number };

export function contar(imoveis: ImovelComprador[]): Contagens {
  return {
    enviados: imoveis.filter((i) => i.enviado_em).length,
    visitas: imoveis.filter((i) => i.visitado_em).length,
    propostas: imoveis.filter((i) => i.proposta_em).length,
  };
}

// Alerta laranja do desenho: lead qualificada há 10+ dias sem passar a imóveis enviados.
export function alertaLaranja(c: Pick<Comprador, "estado" | "estado_desde">): string | null {
  if (c.estado === "lead_qualificada" && diasDesde(c.estado_desde) >= 10) {
    return `${diasDesde(c.estado_desde)} dias sem enviar imóveis`;
  }
  return null;
}

export const TIPOS_IMOVEL = ["Apartamento", "Moradia", "Terreno", "Armazém", "Loja", "Prédio", "Outro"];
export const TIPOLOGIAS = ["T0", "T1", "T2", "T3", "T4", "T5 ou mais"];
export const CANAIS_ORIGEM = ["Idealista", "Imovirtual", "Meta", "Site da imobiliária", "Placa", "Referência", "Outro"];
export const FINANCIAMENTO = ["Capitais próprios", "Crédito pré-aprovado", "Vai pedir crédito"];
export const SIMULACAO_CREDITO = ["Feita", "Por fazer", "Não aplicável"];
export const PREFIXOS = ["+351", "+34", "+33", "+44", "+49", "+41", "+55", "+1"];

/**
 * Tarefas semanais do desenho: "alerta a cada semana" para enviar opções de imóveis
 * (lead qualificada e imóveis enviados até ao 10.º) e para propor visita (visitas até
 * à 5.ª). Sem servidor agendado: corre quando o agente abre o CRM e cria, no máximo,
 * uma tarefa por comprador e por semana (chave_automacao evita duplicados).
 */
export async function garantirTarefasSemanais(
  compradores: Comprador[],
  contagens: Record<string, Contagens>
): Promise<void> {
  const semana = semanaISO(new Date());
  const candidatas: { chave: string; titulo: string; comprador: Comprador }[] = [];

  for (const c of compradores) {
    const n = contagens[c.id] ?? { enviados: 0, visitas: 0, propostas: 0 };
    const nome = c.contactos.nome;
    if (c.estado === "lead_qualificada" || (c.estado === "imoveis_enviados" && n.enviados < OBJETIVOS.enviados)) {
      candidatas.push({ chave: `comprador:${c.id}:enviar:${semana}`, titulo: `Enviar opções de imóveis a ${nome}`, comprador: c });
    } else if (c.estado === "visitas_realizadas" && n.visitas < OBJETIVOS.visitas) {
      candidatas.push({ chave: `comprador:${c.id}:visita:${semana}`, titulo: `Propor visita a ${nome}`, comprador: c });
    }
  }
  if (candidatas.length === 0) return;

  const sb = sbBrowser();
  const { data: existentes } = await sb
    .from("tarefas")
    .select("chave_automacao")
    .in("chave_automacao", candidatas.map((c) => c.chave));
  const jaExiste = new Set((existentes ?? []).map((e) => e.chave_automacao));

  const hoje9h = new Date();
  hoje9h.setHours(9, 0, 0, 0);
  const novas = candidatas
    .filter((c) => !jaExiste.has(c.chave))
    .map((c) => ({
      titulo: c.titulo,
      tipo: "tarefa",
      inicio: hoje9h.toISOString(),
      origem: "comprador",
      comprador_id: c.comprador.id,
      contacto_id: c.comprador.contacto_id,
      chave_automacao: c.chave,
    }));
  if (novas.length > 0) await sb.from("tarefas").insert(novas);
}

export type TipoTarefaComprador = "enviar" | "visita";

// Tarefas semanais automáticas ("Enviar opções de imóveis", "Propor visita"): não se marcam à mão,
// abre-se a ficha do comprador e a tarefa fecha-se quando o consultor regista o envio ou a visita.
export function tipoTarefaComprador(t: { origem: string; chave_automacao: string | null; titulo: string }): TipoTarefaComprador | null {
  if (t.origem !== "comprador") return null;
  const tipo = t.chave_automacao?.split(":")[2];
  if (tipo === "enviar" || tipo === "visita") return tipo;
  // tarefas sem chave de automação (criadas à mão ou por outro script): reconhece-se pelo título
  if (t.titulo.startsWith("Enviar opções de imóveis")) return "enviar";
  if (t.titulo.startsWith("Propor visita")) return "visita";
  return null;
}

/** Dá como feitas as tarefas semanais em aberto deste comprador (também as de semanas anteriores). */
export async function concluirTarefasSemanais(compradorId: string, tipo: TipoTarefaComprador): Promise<void> {
  await sbBrowser()
    .from("tarefas")
    .update({ feita: true, feita_em: new Date().toISOString() })
    .like("chave_automacao", `comprador:${compradorId}:${tipo}:%`)
    .eq("feita", false);
}
