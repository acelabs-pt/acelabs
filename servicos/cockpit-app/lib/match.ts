import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { TIPOLOGIAS, type Comprador } from "@/lib/comprador";
import type { Proprietario } from "@/lib/proprietario";
import type { Angariacao } from "@/lib/angariacao";
import type { Local } from "@/lib/localizacoes";

// Cruzamento entre compradores e imóveis (o imóvel é a ficha do proprietário, que a angariação usa).
// O alerta fica por verificar até o consultor decidir se faz sentido ou não.

export const MARGEM_VALOR = 0.1; // o imóvel pode custar até 10% acima da expectativa do comprador

// Compradores já com CPCV (ou mais à frente) ou perdidos deixam de receber sugestões.
const COMPRADOR_FORA = ["cpcv", "escritura", "negocio_concluido", "perdido"];

export type Decisao = "faz_sentido" | "nao_faz_sentido";

export type Match = {
  comprador: Comprador;
  proprietario: Proprietario;
  angariacao: Angariacao | null; // null = proprietário ainda por angariar
  confirmado: boolean; // o consultor já disse "faz sentido"
};

const zonaCobre = (l: Local, p: Proprietario) =>
  l.distrito === p.distrito &&
  (!l.concelho || l.concelho === p.concelho) &&
  (!l.freguesia || l.freguesia === p.freguesia);

/** Zona obrigatória; tipo, tipologia e valor só contam se comprador e imóvel os tiverem preenchidos. */
export function compativel(c: Comprador, p: Proprietario): boolean {
  if (!(c.localizacoes ?? []).some((l) => zonaCobre(l, p))) return false;
  if (c.tipo_imovel && p.tipo_imovel && c.tipo_imovel !== p.tipo_imovel) return false;
  if (c.tipologia_minima && p.tipologia) {
    const minima = TIPOLOGIAS.indexOf(c.tipologia_minima);
    const tipologia = TIPOLOGIAS.indexOf(p.tipologia);
    if (minima >= 0 && tipologia >= 0 && tipologia < minima) return false;
  }
  if (c.expectativa_valor != null && p.valor != null && p.valor > c.expectativa_valor * (1 + MARGEM_VALOR)) return false;
  return true;
}

export function etiquetaImovel(m: Pick<Match, "proprietario" | "angariacao">): string {
  const p = m.proprietario;
  return (
    m.angariacao?.titulo ||
    [p.tipo_imovel, p.tipologia, p.freguesia || p.concelho || p.distrito].filter(Boolean).join(" · ") ||
    p.contactos.nome
  );
}

export async function carregarMatches(): Promise<Match[]> {
  const sb = sbBrowser();
  const [c, p, a, d] = await Promise.all([
    sb.from("compradores").select("*, contactos(*)"),
    sb.from("proprietarios").select("*, contactos(*)"),
    sb.from("angariacoes").select("*"),
    sb.from("alertas_match").select("*"),
  ]);
  if (c.error || p.error || a.error || d.error) return [];

  const angariacoes = (a.data ?? []) as unknown as Angariacao[];
  const decisoes = new Map((d.data ?? []).map((x) => [`${x.comprador_id}:${x.proprietario_id}`, x.estado as Decisao]));
  const out: Match[] = [];

  for (const prop of (p.data ?? []) as unknown as Proprietario[]) {
    if (prop.estado === "perdido") continue;
    const dele = angariacoes.filter((x) => x.proprietario_id === prop.id);
    const ativa = dele.find((x) => !x.vendido_em) ?? null;
    if (dele.length > 0 && !ativa) continue; // tudo vendido
    for (const comp of (c.data ?? []) as unknown as Comprador[]) {
      if (COMPRADOR_FORA.includes(comp.estado) || !compativel(comp, prop)) continue;
      const decisao = decisoes.get(`${comp.id}:${prop.id}`);
      if (decisao === "nao_faz_sentido") continue;
      out.push({ comprador: comp, proprietario: prop, angariacao: ativa, confirmado: decisao === "faz_sentido" });
    }
  }
  return out;
}

/** estado null = desfazer a decisão (volta a ficar por verificar). */
export async function decidirMatch(compradorId: string, proprietarioId: string, estado: Decisao | null): Promise<string | null> {
  const sb = sbBrowser();
  const { error } =
    estado === null
      ? await sb.from("alertas_match").delete().eq("comprador_id", compradorId).eq("proprietario_id", proprietarioId)
      : await sb
          .from("alertas_match")
          .upsert({ comprador_id: compradorId, proprietario_id: proprietarioId, estado, decidido_em: new Date().toISOString() });
  return error ? "Não foi possível guardar a decisão." : null;
}

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const recarregar = useCallback(async () => setMatches(await carregarMatches()), []);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { matches, recarregar };
}
