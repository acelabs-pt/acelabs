import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";

export type Contacto = { id: string; ocorreu_em: string; observacoes: string | null };

/** Quando foi a última chamada registada a cada contacto (id do contacto -> data). Sem chamadas, o contacto não aparece. */
export async function ultimosContactos(): Promise<Record<string, string>> {
  const sb = sbBrowser();
  const r = await todas<{ contacto_id: string; ocorreu_em: string }>((de, ate) =>
    sb.from("chamadas").select("contacto_id, ocorreu_em").order("id").range(de, ate)
  );
  const out: Record<string, string> = {};
  for (const c of r.data) if (!out[c.contacto_id] || c.ocorreu_em > out[c.contacto_id]) out[c.contacto_id] = c.ocorreu_em;
  return out;
}

/** Regista uma chamada feita agora. Devolve o id (para a poder desfazer) ou null se falhar. */
export async function registarChamadaAgora(contactoId: string, observacoes: string | null = null): Promise<string | null> {
  const { data, error } = await sbBrowser()
    .from("chamadas")
    .insert({ contacto_id: contactoId, ocorreu_em: new Date().toISOString(), observacoes })
    .select("id")
    .single();
  return error || !data ? null : (data.id as string);
}

export async function apagarChamada(id: string): Promise<boolean> {
  const { error } = await sbBrowser().from("chamadas").delete().eq("id", id);
  return !error;
}

/** "hoje", "ontem", "há 5 dias", "há 3 semanas", "há 2 meses". */
export function haQuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 14) return `há ${dias} dias`;
  if (dias < 60) return `há ${Math.floor(dias / 7)} semanas`;
  return `há ${Math.floor(dias / 30)} meses`;
}
