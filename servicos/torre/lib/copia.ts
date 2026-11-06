import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTodos } from "./supabase";

// Tabelas que entram na cópia de segurança (o plano grátis do Supabase não faz cópias).
export const TABELAS_COPIA = [
  "socios",
  "contas",
  "categorias",
  "entidades",
  "subscricoes",
  "regras",
  "importacoes",
  "movimentos",
  "socios_movimentos",
  "faturas",
  "contratos",
  "auditoria",
] as const;

export async function copiaDeTudo(s: SupabaseClient) {
  const tabelas: Record<string, unknown[]> = {};
  for (const t of TABELAS_COPIA) tabelas[t] = await lerTodos(s, t);
  return { torre: 1, feita_em: new Date().toISOString(), tabelas };
}
