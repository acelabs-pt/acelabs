import { sbBrowser } from "@/lib/supabase-browser";
import { blocoDeDia, dataDoDia } from "@/lib/angariacao";
import { todas } from "@/lib/todas";

// Totais do plano de cada angariação (ações feitas, em atraso, próxima ação). O dashboard e a lista de
// angariações só precisam disto, e descarregar as ~59 ações de cada angariação para o browser deixava
// a app a demorar mais de 20 segundos com 1000 angariações.
export type ResumoAng = { total: number; feitas: number; emAtraso: number; proximaNome: string | null; proximaFollowUp: boolean };

type Linha = { angariacao_id: string; total: number; feitas: number; em_atraso: number; proxima_nome: string | null; proxima_follow_up: boolean | null };

/**
 * Usa a função `resumo_angariacoes` da base (ver migracao_escala.sql): uma linha por angariação.
 * Se a função ainda não existir nesta base, calcula no browser a partir de só quatro colunas das ações
 * (mais devagar, mas funciona).
 */
export async function carregarResumo(): Promise<Record<string, ResumoAng>> {
  const sb = sbBrowser();
  const r = await todas<Linha>((de, ate) => sb.rpc("resumo_angariacoes").order("angariacao_id").range(de, ate));
  if (!r.error) {
    const out: Record<string, ResumoAng> = {};
    for (const l of r.data) {
      out[l.angariacao_id] = {
        total: l.total,
        feitas: l.feitas,
        emAtraso: l.em_atraso,
        proximaNome: l.proxima_nome,
        proximaFollowUp: !!l.proxima_follow_up,
      };
    }
    return out;
  }
  return resumoNoBrowser();
}

async function resumoNoBrowser(): Promise<Record<string, ResumoAng>> {
  const sb = sbBrowser();
  const [angs, acoes] = await Promise.all([
    todas<{ id: string; inicio: string }>((de, ate) => sb.from("angariacoes").select("id, inicio").order("id").range(de, ate)),
    todas<{ angariacao_id: string; dia: number; feita: boolean; nome: string; follow_up: boolean }>((de, ate) =>
      sb.from("angariacao_acoes").select("angariacao_id, dia, feita, nome, follow_up").order("id").range(de, ate)
    ),
  ]);
  const inicio = new Map(angs.data.map((a) => [a.id, a.inicio]));
  const agora = new Date();
  const out: Record<string, ResumoAng> = {};
  for (const x of acoes.data) {
    const r = (out[x.angariacao_id] ??= { total: 0, feitas: 0, emAtraso: 0, proximaNome: null, proximaFollowUp: false });
    r.total++;
    if (x.feita) r.feitas++;
    else {
      const ini = inicio.get(x.angariacao_id);
      if (ini && dataDoDia(ini, blocoDeDia(x.dia) * 10) < agora) r.emAtraso++;
    }
  }
  // próxima ação por fazer: a de menor dia
  const menor = new Map<string, { dia: number; nome: string; follow_up: boolean }>();
  for (const x of acoes.data) {
    if (x.feita) continue;
    const m = menor.get(x.angariacao_id);
    if (!m || x.dia < m.dia) menor.set(x.angariacao_id, { dia: x.dia, nome: x.nome, follow_up: x.follow_up });
  }
  for (const [id, m] of menor) {
    out[id].proximaNome = m.nome;
    out[id].proximaFollowUp = m.follow_up;
  }
  return out;
}
