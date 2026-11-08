import { sbBrowser } from "@/lib/supabase-browser";
import type { Tarefa } from "@/lib/types";
import { dataLocal, moverAcao, type Acao, type Angariacao } from "@/lib/angariacao";
import { inicioDoDia } from "@/lib/datas";

/** Marca uma tarefa como feita/por fazer e mantém a ação do plano de angariação em sintonia. */
export async function marcarTarefa(t: Tarefa, feita: boolean): Promise<string | null> {
  const sb = sbBrowser();
  const feita_em = feita ? new Date().toISOString() : null;
  const { error } = await sb.from("tarefas").update({ feita, feita_em }).eq("id", t.id);
  if (error) return "Não foi possível guardar. Tenta outra vez.";
  if (t.angariacao_acao_id) {
    await sb.from("angariacao_acoes").update({ feita, feita_em }).eq("id", t.angariacao_acao_id);
  }
  return null;
}

/** A tarefa já não faz sentido: fecha-se como "não feita" (não avança o funil nem cria nada) e fica com a data em que foi descartada. */
export async function marcarNaoFeita(t: Tarefa): Promise<string | null> {
  const agora = new Date().toISOString();
  const { error } = await sbBrowser().from("tarefas").update({ feita: true, feita_em: agora, nao_feita_em: agora }).eq("id", t.id);
  return error ? "Não foi possível guardar. Tenta outra vez." : null;
}

/** Desfaz o "não feita": a tarefa volta a estar por fazer. */
export async function reporTarefa(t: Pick<Tarefa, "id">): Promise<string | null> {
  const { error } = await sbBrowser().from("tarefas").update({ feita: false, feita_em: null, nao_feita_em: null }).eq("id", t.id);
  return error ? "Não foi possível repor a tarefa." : null;
}

/**
 * Passa uma tarefa para outro dia, mantendo a hora. Se for uma ação de um plano de angariação,
 * move também a ação no plano (é a mesma coisa vista de dois sítios).
 */
export async function adiarTarefa(t: Tarefa, dia: Date): Promise<string | null> {
  const sb = sbBrowser();
  const orig = t.inicio ? new Date(t.inicio) : null;
  const novo = new Date(dia);
  novo.setHours(orig ? orig.getHours() : 9, orig ? orig.getMinutes() : 0, 0, 0);

  if (t.angariacao_acao_id) {
    const { data: a } = await sb.from("angariacao_acoes").select("*").eq("id", t.angariacao_acao_id).single();
    if (a) {
      const [{ data: ang }, { data: outras }] = await Promise.all([
        sb.from("angariacoes").select("*, proprietarios(contactos(nome))").eq("id", (a as Acao).angariacao_id).single(),
        sb.from("angariacao_acoes").select("*").eq("angariacao_id", (a as Acao).angariacao_id),
      ]);
      if (ang) {
        const dias = Math.round((inicioDoDia(novo).getTime() - dataLocal((ang as Angariacao).inicio).getTime()) / 86400000);
        return moverAcao(ang as unknown as Angariacao, a as Acao, (outras ?? []) as Acao[], dias);
      }
    }
  }

  const campos: Record<string, string> = { inicio: novo.toISOString() };
  if (orig && t.fim) campos.fim = new Date(new Date(t.fim).getTime() + (novo.getTime() - orig.getTime())).toISOString();
  const { error } = await sb.from("tarefas").update(campos).eq("id", t.id);
  if (error) return "Não foi possível adiar.";
  // visita agendada na ficha do comprador: a data da visita acompanha o evento
  const m = t.chave_automacao?.match(/^comprador:[^:]+:agendada:(.+)$/);
  if (m) {
    const iso = `${novo.getFullYear()}-${String(novo.getMonth() + 1).padStart(2, "0")}-${String(novo.getDate()).padStart(2, "0")}`;
    await sb.from("comprador_imoveis").update({ visitado_em: iso }).eq("id", m[1]);
  }
  return null;
}
