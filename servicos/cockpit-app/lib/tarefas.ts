import { sbBrowser } from "@/lib/supabase-browser";
import type { Tarefa } from "@/lib/types";

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
