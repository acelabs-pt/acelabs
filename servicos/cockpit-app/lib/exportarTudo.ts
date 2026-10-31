import { sbBrowser } from "@/lib/supabase-browser";
import { labelEstado, type EstadoComprador } from "@/lib/comprador";
import { labelEstadoProp, type EstadoProprietario } from "@/lib/proprietario";
import { ESQUEMAS, type Entidade } from "@/lib/importar/esquemas";
import { todas } from "@/lib/todas";

type Linha = Record<string, unknown>;

const hoje = () => new Date().toISOString().slice(0, 10);

function descarregar(conteudo: string, ficheiro: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ficheiro;
  a.click();
  URL.revokeObjectURL(url);
}

async function ler(tabela: string, select = "*", ordem = "id"): Promise<Linha[]> {
  const sb = sbBrowser();
  const r = await todas<Linha>((de, ate) => sb.from(tabela).select(select).order(ordem).range(de, ate));
  if (r.error) throw new Error("Não foi possível ler os dados.");
  return r.data;
}

const dataPt = (iso: unknown) => {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const txt = (v: unknown) => (v == null ? "" : String(v));
const zonaTxt = (z: Linha) => [z.distrito, z.concelho, z.freguesia].filter(Boolean).join("/");

/**
 * Linhas de uma lista no formato dos modelos de importação (mesmas colunas e mesmos valores), para abrir
 * no Excel ou voltar a importar noutro Cockpit.
 */
export async function linhasParaCsv(e: Entidade): Promise<Record<string, string>[]> {
  if (e === "angariacoes") {
    const angs = await ler("angariacoes");
    return angs.map((a) => ({
      titulo: txt(a.titulo),
      inicio: dataPt(a.inicio),
      duracao_dias: txt(a.duracao_dias),
      regime: a.regime === "exclusivo" ? "Exclusivo" : a.regime === "nao_exclusivo" ? "Não exclusivo" : "",
      tipo_imovel: txt(a.tipo_imovel),
      distrito: txt(a.distrito),
      concelho: txt(a.concelho),
      freguesia: txt(a.freguesia),
      tipologia: txt(a.tipologia),
      valor: txt(a.valor),
    }));
  }

  const select = "*, contactos(nome, telemovel, email, canal_origem, observacoes)";
  const fichas = await ler(e, select);
  const zonasPorComprador = new Map<string, Linha[]>();
  if (e === "compradores") {
    for (const z of await ler("comprador_zonas")) {
      const k = z.comprador_id as string;
      zonasPorComprador.set(k, [...(zonasPorComprador.get(k) ?? []), z]);
    }
  }
  return fichas.map((f) => {
    const c = (f.contactos ?? {}) as Linha;
    const contacto = {
      nome: txt(c.nome),
      telemovel: txt(c.telemovel),
      email: txt(c.email),
      canal_origem: txt(c.canal_origem),
      observacoes: txt(c.observacoes),
      tipo_imovel: txt(f.tipo_imovel),
      distrito: txt(f.distrito),
      concelho: txt(f.concelho),
      freguesia: txt(f.freguesia),
    };
    if (e === "proprietarios") {
      return { ...contacto, tipologia: txt(f.tipologia), valor: txt(f.valor), link_imovel: txt(f.link_imovel), estado: labelEstadoProp(f.estado as EstadoProprietario) };
    }
    const principal = zonaTxt(f);
    const outras = (zonasPorComprador.get(f.id as string) ?? []).map(zonaTxt).filter((z) => z && z !== principal);
    return {
      ...contacto,
      motivacao: txt(f.motivacao),
      outras_zonas: [...new Set(outras)].join(" | "),
      tipologia_minima: txt(f.tipologia_minima),
      expectativa_valor: txt(f.expectativa_valor),
      financiamento: txt(f.financiamento),
      precisa_vender: f.precisa_vender === true ? "Sim" : f.precisa_vender === false ? "Não" : "",
      referencia_imovel: txt(f.referencia_imovel),
      estado: labelEstado(f.estado as EstadoComprador),
    };
  });
}

/** CSV com ";" e BOM (o Excel em português abre bem), cabeçalho igual ao do modelo de importação. */
export function paraCsv(e: Entidade, linhas: Record<string, string>[]): string {
  const cols = ESQUEMAS[e].colunas;
  const esc = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const corpo = linhas.map((l) => cols.map((c) => esc(l[c.chave] ?? "")).join(";"));
  return "﻿" + [cols.map((c) => esc(c.rotulo)).join(";"), ...corpo].join("\r\n") + "\r\n";
}

/** Descarrega uma lista em CSV. Devolve quantas linhas tinha. */
export async function exportarLista(e: Entidade): Promise<number> {
  const linhas = await linhasParaCsv(e);
  descarregar(paraCsv(e, linhas), `cockpit-${e}-${hoje()}.csv`, "text/csv;charset=utf-8");
  return linhas.length;
}

// Tabelas da app e a coluna por onde se ordenam (as de metas não têm id).
const TABELAS: [string, string][] = [
  ["contactos", "id"],
  ["compradores", "id"],
  ["comprador_zonas", "id"],
  ["comprador_imoveis", "id"],
  ["comprador_documentos", "id"],
  ["proprietarios", "id"],
  ["angariacoes", "id"],
  ["angariacao_acoes", "id"],
  ["tarefas", "id"],
  ["chamadas", "id"],
  ["correspondencias", "id"],
  ["metas", "id"],
  ["metas_config", "ano"],
  ["metas_semanas", "semana"],
];

/**
 * Cópia de tudo o que está no Cockpit, tabela a tabela, num ficheiro JSON. Serve de cópia de segurança e é o
 * que se entrega ao cliente no fim do contrato. Só lê. Devolve o número de registos por tabela.
 */
export async function exportarCopiaCompleta(onProgresso?: (tabela: string) => void): Promise<Record<string, number>> {
  const dados: Record<string, Linha[]> = {};
  for (const [t, ordem] of TABELAS) {
    onProgresso?.(t);
    dados[t] = await ler(t, "*", ordem);
  }
  const contagem = Object.fromEntries(Object.entries(dados).map(([t, l]) => [t, l.length]));
  const copia = { exportado_em: new Date().toISOString(), origem: "Cockpit (Ace Labs)", registos: contagem, tabelas: dados };
  descarregar(JSON.stringify(copia, null, 2), `cockpit-copia-completa-${hoje()}.json`, "application/json;charset=utf-8");
  return contagem;
}
