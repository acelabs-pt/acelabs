import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cliente Supabase com a sessão de quem está a usar a Torre (cookies). Respeita as regras de acesso (RLS): fora da
// tabela `socios` (ou desativado), não lê nem escreve nada. A service_role nunca é usada pela app, só pelos scripts locais.
export function sb(): SupabaseClient {
  const loja = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(aGravar) {
        try {
          aGravar.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Num Server Component não se pode escrever cookies; o middleware já trata de refrescar a sessão.
        }
      },
    },
  });
}

/** Lê uma tabela inteira, de 1000 em 1000 (o Supabase devolve no máximo 1000 linhas por pedido). */
export async function lerTodos<T>(s: SupabaseClient, tabela: string, ordem?: string): Promise<T[]> {
  const r: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = s.from(tabela).select("*");
    if (ordem) q = q.order(ordem, { ascending: false });
    const { data, error } = await q.order("id").range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    r.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return r;
  }
}
