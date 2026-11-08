import { sbBrowser } from "@/lib/supabase-browser";
import { semanaISO, diasDesde } from "@/lib/datas";
import { distribuirHoras } from "@/lib/horas";

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
  tipo_negocio: string | null;
  tipo_imovel: string | null;
  // primeira zona de procura; todas as zonas estão em comprador_zonas
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
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
  angariacao_id: string | null; // quando o imóvel é uma angariação minha
  visita_obs: string | null;
  visita_hora: string | null;
  sem_interesse_em: string | null;
  proposta_obs: string | null;
};

export type Contagens = { enviados: number; visitas: number; propostas: number };

export function contar(imoveis: ImovelComprador[]): Contagens {
  return {
    enviados: imoveis.filter((i) => i.enviado_em).length,
    visitas: imoveis.filter((i) => i.visitado_em).length,
    propostas: imoveis.filter((i) => i.proposta_em).length,
  };
}

/**
 * Automação "Agendar escritura": com o CPCV fechado e o prazo da escritura definido, cria uma tarefa para marcar o dia da escritura
 * (uma por comprador). Fecha-se sozinha quando a escritura fica agendada. Pode chamar-se sempre que a ficha carrega.
 */
export async function sincronizarTarefaEscritura(c: {
  id: string;
  contacto_id: string;
  nome: string;
  cpcv_fechado: boolean;
  escritura_prazo: string | null;
  escritura_agendada: boolean;
}): Promise<void> {
  if (!c.cpcv_fechado) return;
  const sb = sbBrowser();
  const chave = `comprador:${c.id}:agendar-escritura`;
  if (c.escritura_agendada) {
    await sb.from("tarefas").update({ feita: true, feita_em: new Date().toISOString() }).eq("chave_automacao", chave).eq("feita", false);
    return;
  }
  if (!c.escritura_prazo) return;
  const { data } = await sb.from("tarefas").select("id").eq("chave_automacao", chave).limit(1);
  if ((data ?? []).length > 0) return;
  const [quando] = await distribuirHoras([{ chave, dia: new Date() }]);
  await sb.from("tarefas").insert({
    titulo: `Agendar escritura com ${c.nome}`,
    tipo: "tarefa",
    inicio: quando.toISOString(),
    origem: "comprador",
    comprador_id: c.id,
    contacto_id: c.contacto_id,
    chave_automacao: chave,
  });
}

// Próximo passo a fazer com o comprador, conforme a fase do funil (e as metas de 10 envios e 5 visitas das tarefas semanais).
export function proximoPasso(
  c: Pick<Comprador, "estado" | "escritura_prazo" | "escritura_agendada">,
  n: Contagens = { enviados: 0, visitas: 0, propostas: 0 }
): string | null {
  switch (c.estado) {
    case "lead_qualificada":
      return "Enviar opções de imóveis";
    case "imoveis_enviados":
      return n.enviados < OBJETIVOS.enviados ? "Enviar opções de imóveis" : "Propor visita";
    case "visitas_realizadas":
      return n.visitas < OBJETIVOS.visitas ? "Propor visita" : "Fazer proposta";
    case "propostas_efetuadas":
      return "Avançar para CPCV / enviar outras opções";
    case "cpcv":
      return !c.escritura_prazo ? "Definir prazo da escritura" : !c.escritura_agendada ? "Agendar escritura" : "Aguardar a escritura";
    case "escritura":
      return "Concluir negócio após a escritura";
    case "negocio_concluido":
      return "Ligar 6 meses após a escritura";
    default:
      return null;
  }
}

// Alerta laranja do desenho: lead qualificada há 10+ dias sem passar a imóveis enviados.
export function alertaLaranja(c: Pick<Comprador, "estado" | "estado_desde">): string | null {
  if (c.estado === "lead_qualificada" && diasDesde(c.estado_desde) >= 10) {
    return `${diasDesde(c.estado_desde)} dias sem enviar imóveis`;
  }
  return null;
}

export const TIPOS_IMOVEL = ["Apartamento", "Moradia", "Terreno", "Armazém", "Loja", "Prédio", "Outro"];
/** Tipos de imóvel que fazem sentido para cada tipo de negócio (sem negócio escolhido, mostram-se todos). */
export function tiposImovelPara(negocio: string): string[] {
  if (negocio === "Comercial") return ["Loja", "Armazém", "Prédio", "Terreno", "Outro"];
  if (negocio === "Habitação") return ["Apartamento", "Moradia", "Prédio", "Terreno", "Outro"];
  return TIPOS_IMOVEL;
}
export const TIPOS_NEGOCIO = ["Habitação", "Comercial"];
export const TIPOLOGIAS = ["T0", "T1", "T2", "T3", "T4", "T5 ou mais"];
export const CANAIS_ORIGEM = ["Idealista", "Imovirtual", "Meta", "Site da imobiliária", "Placa", "Referência", "Outro"];
export const FINANCIAMENTO = ["Capitais próprios", "Crédito pré-aprovado", "Vai pedir crédito"];
export const SIMULACAO_CREDITO = ["Feita", "Em processamento", "Por fazer", "Não aplicável"];
// Documentos do comprador para a escritura (lista definida pelo Miguel). O cheque bancário leva o valor ao lado.
export const DOCUMENTOS_ESCRITURA = ["Documento de identificação", "Cheque Bancário"];
export const comValor = (nome: string) => nome.trim().toLowerCase().startsWith("cheque");


export const PREFIXOS = ["+351", "+34", "+33", "+44", "+49", "+41", "+55", "+1"];

/**
 * Tarefas semanais do desenho: "alerta a cada semana" para enviar opções de imóveis
 * (lead qualificada e imóveis enviados até ao 10.º) e para propor visita (visitas até
 * à 5.ª). Sem servidor agendado: corre quando o agente abre o CRM e cria, no máximo,
 * uma tarefa por comprador e por semana (chave_automacao evita duplicados). Devolve quantas criou.
 */
export async function garantirTarefasSemanais(
  compradores: Comprador[],
  contagens: Record<string, Contagens>
): Promise<number> {
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
  if (candidatas.length === 0) return 0;

  const sb = sbBrowser();
  const { data: existentes } = await sb
    .from("tarefas")
    .select("chave_automacao")
    .in("chave_automacao", candidatas.map((c) => c.chave));
  const jaExiste = new Set((existentes ?? []).map((e) => e.chave_automacao));

  const porCriar = candidatas.filter((c) => !jaExiste.has(c.chave));
  const horas = await distribuirHoras(porCriar.map((c) => ({ chave: c.chave, dia: new Date() })));
  const novas = porCriar.map((c, i) => ({
    titulo: c.titulo,
    tipo: "tarefa",
    inicio: horas[i].toISOString(),
    origem: "comprador",
    comprador_id: c.comprador.id,
    contacto_id: c.comprador.contacto_id,
    chave_automacao: c.chave,
  }));
  if (novas.length > 0) await sb.from("tarefas").insert(novas);
  return novas.length;
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

/** Põe (ou atualiza) a visita no calendário como evento de 1 hora. Uma por imóvel do comprador. Devolve erro em texto ou null. */
export async function sincronizarEventoVisita(
  comprador: { id: string; contacto_id: string; nome: string },
  imovelId: string,
  descricao: string,
  data: string,
  hora: string
): Promise<string | null> {
  const inicio = new Date(`${data}T${hora}`);
  if (Number.isNaN(inicio.getTime())) return "Data ou hora inválida.";
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
  const chave = `comprador:${comprador.id}:agendada:${imovelId}`;
  const campos = { titulo: `Visita: ${descricao} (${comprador.nome})`, inicio: inicio.toISOString(), fim: fim.toISOString() };
  const sb = sbBrowser();
  const { data: existente } = await sb.from("tarefas").select("id").eq("chave_automacao", chave).maybeSingle();
  const { error } = existente
    ? await sb.from("tarefas").update(campos).eq("id", existente.id)
    : await sb.from("tarefas").insert({
        ...campos,
        tipo: "evento",
        origem: "comprador",
        comprador_id: comprador.id,
        contacto_id: comprador.contacto_id,
        chave_automacao: chave,
      });
  return error ? "A visita ficou guardada, mas não foi possível pô-la no calendário." : null;
}

/** Tira do calendário a visita agendada deste imóvel (quando se desfaz o "Visitado"). */
export async function removerEventoVisita(compradorId: string, imovelId: string): Promise<void> {
  await sbBrowser().from("tarefas").delete().eq("chave_automacao", `comprador:${compradorId}:agendada:${imovelId}`);
}

type RegistoAng = { compradorId: string; angariacaoId: string; descricao: string; data: string; obs: string };

/**
 * Regista uma visita ou uma proposta de um comprador a uma angariação (a partir da página da angariação).
 * Faz o mesmo que marcar "Visitado" ou "Proposta" na ficha do comprador. Se o comprador já tem este imóvel
 * ligado à angariação (por exemplo, "enviado"), aproveita a mesma linha em vez de criar outra.
 */
async function registarMarco(tipo: "visita" | "proposta", v: RegistoAng): Promise<string | null> {
  const campo = tipo === "visita" ? "visitado_em" : "proposta_em";
  const campoObs = tipo === "visita" ? "visita_obs" : "proposta_obs";
  const sb = sbBrowser();
  const { data: existentes } = await sb
    .from("comprador_imoveis")
    .select("id, visitado_em, proposta_em")
    .eq("comprador_id", v.compradorId)
    .eq("angariacao_id", v.angariacaoId);
  const livre = ((existentes ?? []) as Record<string, string | null>[]).find((x) => !x[campo]);
  const valores = { [campo]: v.data, [campoObs]: v.obs.trim() || null };
  const { error } = livre
    ? await sb.from("comprador_imoveis").update(valores).eq("id", livre.id)
    : await sb
        .from("comprador_imoveis")
        .insert({ comprador_id: v.compradorId, angariacao_id: v.angariacaoId, descricao: v.descricao, ...valores });
  if (error) return `Não foi possível registar a ${tipo}.`;
  if (tipo === "visita") await concluirTarefasSemanais(v.compradorId, "visita");
  const destino: EstadoComprador = tipo === "visita" ? "visitas_realizadas" : "propostas_efetuadas";
  const { data: c } = await sb.from("compradores").select("estado").eq("id", v.compradorId).single();
  if (c && c.estado !== "perdido" && indiceFunil(c.estado as EstadoComprador) < indiceFunil(destino)) {
    await sb.from("compradores").update({ estado: destino, estado_desde: new Date().toISOString() }).eq("id", v.compradorId);
  }
  return null;
}

export const registarVisita = (v: RegistoAng) => registarMarco("visita", v);
export const registarProposta = (v: RegistoAng) => registarMarco("proposta", v);
