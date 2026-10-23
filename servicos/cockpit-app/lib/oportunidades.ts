import { sbBrowser } from "@/lib/supabase-browser";
import { TIPOLOGIAS } from "@/lib/comprador";
import { todas } from "@/lib/todas";

// Correspondência entre um comprador e um imóvel (angariação ou proprietário ainda sem angariação).
// Regra: a zona do imóvel tem de estar numa das zonas do comprador; tipo, tipologia e preço só
// excluem quando os dois lados têm o dado preenchido (dado em falta não exclui, para não perder
// oportunidades por campos por preencher).

export type Zona = { distrito: string; concelho: string | null; freguesia: string | null };

export type Imovel = {
  tipo_imovel: string | null;
  tipologia: string | null;
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
  valor: number | null;
};

export type PerfilComprador = {
  tipo_imovel: string | null;
  tipologia_minima: string | null;
  expectativa_valor: number | null;
};

// O imóvel pode custar até 10% acima da expectativa do comprador.
export const TOLERANCIA_PRECO = 0.1;

// Só compradores ainda a procurar imóvel geram alertas.
export const ESTADOS_A_PROCURAR = ["lead_qualificada", "imoveis_enviados", "visitas_realizadas", "propostas_efetuadas"];

export function zonaCobre(z: Zona, i: Imovel): boolean {
  if (!i.distrito || z.distrito !== i.distrito) return false;
  if (z.concelho && z.concelho !== i.concelho) return false;
  if (z.freguesia && z.freguesia !== i.freguesia) return false;
  return true;
}

export function corresponde(c: PerfilComprador, zonas: Zona[], i: Imovel): boolean {
  if (!zonas.some((z) => zonaCobre(z, i))) return false;
  if (c.tipo_imovel && i.tipo_imovel && c.tipo_imovel !== i.tipo_imovel) return false;
  if (c.tipologia_minima && i.tipologia) {
    const minimo = TIPOLOGIAS.indexOf(c.tipologia_minima);
    const do_imovel = TIPOLOGIAS.indexOf(i.tipologia);
    if (minimo >= 0 && do_imovel >= 0 && do_imovel < minimo) return false;
  }
  if (c.expectativa_valor && i.valor && i.valor > c.expectativa_valor * (1 + TOLERANCIA_PRECO)) return false;
  return true;
}

type CompradorRow = PerfilComprador & { id: string; estado: string };
type ZonaRow = Zona & { comprador_id: string };
type AngariacaoRow = Imovel & { id: string; vendido_em: string | null };
type ProprietarioRow = Imovel & { id: string; estado: string };

const COLUNAS_IMOVEL = "tipo_imovel, tipologia, distrito, concelho, freguesia, valor";

function agrupar(zonas: ZonaRow[]): Record<string, Zona[]> {
  const por: Record<string, Zona[]> = {};
  for (const z of zonas) (por[z.comprador_id] ??= []).push(z);
  return por;
}

type Novo = { comprador_id: string; angariacao_id?: string; proprietario_id?: string };

async function inserirNovos(novos: Novo[], existentes: Set<string>, chave: (n: Novo) => string): Promise<void> {
  const faltam = novos.filter((n) => !existentes.has(chave(n)));
  if (faltam.length === 0) return;
  for (let i = 0; i < faltam.length; i += 500) {
    await sbBrowser().from("correspondencias").insert(faltam.slice(i, i + 500));
  }
}

/** Procura imóveis (angariações ativas e proprietários por angariar) para um comprador. */
export async function atualizarPorComprador(compradorId: string): Promise<void> {
  const sb = sbBrowser();
  const { data: c } = await sb.from("compradores").select("id, estado, tipo_imovel, tipologia_minima, expectativa_valor").eq("id", compradorId).single();
  if (!c || !ESTADOS_A_PROCURAR.includes((c as CompradorRow).estado)) return;
  const [{ data: zonas }, ang, prop, { data: ex }] = await Promise.all([
    sb.from("comprador_zonas").select("distrito, concelho, freguesia").eq("comprador_id", compradorId),
    todas<AngariacaoRow>((de, ate) => sb.from("angariacoes").select(`id, vendido_em, ${COLUNAS_IMOVEL}`).is("vendido_em", null).order("id").range(de, ate)),
    todas<ProprietarioRow>((de, ate) =>
      sb.from("proprietarios").select(`id, estado, ${COLUNAS_IMOVEL}`).not("estado", "in", "(angariado,perdido)").order("id").range(de, ate)
    ),
    sb.from("correspondencias").select("angariacao_id, proprietario_id").eq("comprador_id", compradorId),
  ]);
  const z = (zonas ?? []) as Zona[];
  const existentes = new Set((ex ?? []).map((e) => (e.angariacao_id ? `a:${e.angariacao_id}` : `p:${e.proprietario_id}`)));
  const novos: Novo[] = [
    ...ang.data.filter((a) => corresponde(c as CompradorRow, z, a)).map((a) => ({ comprador_id: compradorId, angariacao_id: a.id })),
    ...prop.data.filter((p) => corresponde(c as CompradorRow, z, p)).map((p) => ({ comprador_id: compradorId, proprietario_id: p.id })),
  ];
  await inserirNovos(novos, existentes, (n) => (n.angariacao_id ? `a:${n.angariacao_id}` : `p:${n.proprietario_id}`));
}

async function compradoresAProcurar() {
  const sb = sbBrowser();
  const [cs, zs] = await Promise.all([
    todas<CompradorRow>((de, ate) =>
      sb.from("compradores").select("id, estado, tipo_imovel, tipologia_minima, expectativa_valor").in("estado", ESTADOS_A_PROCURAR).order("id").range(de, ate)
    ),
    todas<ZonaRow>((de, ate) => sb.from("comprador_zonas").select("comprador_id, distrito, concelho, freguesia").order("id").range(de, ate)),
  ]);
  return { compradores: cs.data, zonas: agrupar(zs.data) };
}

/** Procura compradores para uma angariação (chamar depois de a criar ou editar). */
export async function atualizarPorAngariacao(angariacaoId: string): Promise<void> {
  const sb = sbBrowser();
  const { data: a } = await sb.from("angariacoes").select(`id, vendido_em, ${COLUNAS_IMOVEL}`).eq("id", angariacaoId).single();
  if (!a || (a as AngariacaoRow).vendido_em) return;
  const [{ compradores, zonas }, { data: ex }] = await Promise.all([
    compradoresAProcurar(),
    sb.from("correspondencias").select("comprador_id").eq("angariacao_id", angariacaoId),
  ]);
  const existentes = new Set((ex ?? []).map((e) => e.comprador_id as string));
  const novos = compradores.filter((c) => corresponde(c, zonas[c.id] ?? [], a as AngariacaoRow)).map((c) => ({ comprador_id: c.id, angariacao_id: angariacaoId }));
  await inserirNovos(novos, existentes, (n) => n.comprador_id);
}

/** Procura compradores para um proprietário que ainda não está angariado. */
export async function atualizarPorProprietario(proprietarioId: string): Promise<void> {
  const sb = sbBrowser();
  const { data: p } = await sb.from("proprietarios").select(`id, estado, ${COLUNAS_IMOVEL}`).eq("id", proprietarioId).single();
  if (!p || ["angariado", "perdido"].includes((p as ProprietarioRow).estado)) return;
  const [{ compradores, zonas }, { data: ex }] = await Promise.all([
    compradoresAProcurar(),
    sb.from("correspondencias").select("comprador_id").eq("proprietario_id", proprietarioId),
  ]);
  const existentes = new Set((ex ?? []).map((e) => e.comprador_id as string));
  const novos = compradores.filter((c) => corresponde(c, zonas[c.id] ?? [], p as ProprietarioRow)).map((c) => ({ comprador_id: c.id, proprietario_id: proprietarioId }));
  await inserirNovos(novos, existentes, (n) => n.comprador_id);
}

export type EstadoCorrespondencia = "nova" | "faz_sentido" | "descartada";

export type Correspondencia = {
  id: string;
  comprador_id: string;
  angariacao_id: string | null;
  proprietario_id: string | null;
  estado: EstadoCorrespondencia;
  created_at: string;
  compradores: { contactos: { nome: string } } | null;
  angariacoes: { titulo: string } | null;
  proprietarios: { contactos: { nome: string } } | null;
};

const SELECT_CORRESPONDENCIA = "*, compradores(contactos(nome)), angariacoes(titulo), proprietarios(contactos(nome))";

/** Alertas por rever (estado "nova"), do mais recente para o mais antigo. */
export async function carregarNovas(): Promise<Correspondencia[]> {
  const sb = sbBrowser();
  const r = await todas<Correspondencia>((de, ate) =>
    sb.from("correspondencias").select(SELECT_CORRESPONDENCIA).eq("estado", "nova").order("created_at", { ascending: false }).order("id").range(de, ate)
  );
  return r.error ? [] : r.data;
}

export async function carregarDoComprador(compradorId: string): Promise<Correspondencia[]> {
  const { data } = await sbBrowser()
    .from("correspondencias")
    .select(SELECT_CORRESPONDENCIA)
    .eq("comprador_id", compradorId)
    .neq("estado", "descartada")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Correspondencia[];
}

export async function carregarDaAngariacao(angariacaoId: string): Promise<Correspondencia[]> {
  const { data } = await sbBrowser()
    .from("correspondencias")
    .select(SELECT_CORRESPONDENCIA)
    .eq("angariacao_id", angariacaoId)
    .neq("estado", "descartada")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Correspondencia[];
}

export async function carregarDoProprietario(proprietarioId: string): Promise<Correspondencia[]> {
  const { data } = await sbBrowser()
    .from("correspondencias")
    .select(SELECT_CORRESPONDENCIA)
    .eq("proprietario_id", proprietarioId)
    .neq("estado", "descartada")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Correspondencia[];
}

export async function responder(id: string, estado: EstadoCorrespondencia): Promise<string | null> {
  const { error } = await sbBrowser().from("correspondencias").update({ estado }).eq("id", id);
  return error ? "Não foi possível guardar." : null;
}

/** Quantos alertas por rever tem cada comprador (para o aviso ao lado da barra de motivação). */
export async function contarNovasPorComprador(): Promise<Record<string, number>> {
  const sb = sbBrowser();
  const r = await todas<{ comprador_id: string }>((de, ate) =>
    sb.from("correspondencias").select("comprador_id").eq("estado", "nova").order("id").range(de, ate)
  );
  const por: Record<string, number> = {};
  for (const c of r.data) por[c.comprador_id] = (por[c.comprador_id] ?? 0) + 1;
  return por;
}
