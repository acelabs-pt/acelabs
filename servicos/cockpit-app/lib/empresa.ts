import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A empresa da sessão (migracao_multiempresa.sql). Os INSERT não precisam dela: a base preenche empresa_id sozinha.
 * Só é precisa onde o pedido nomeia a chave inteira, como nas gravações que atualizam por (empresa, ano, metrica).
 */
export async function empresaAtual(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc("empresa_atual");
  return error || !data ? null : (data as string);
}
