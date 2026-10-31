import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { COOKIE_CLIENTE, configSb } from "@/lib/clientes";

// Cliente ligado à sessão do utilizador autenticado (via cookies), para usar
// em Server Components e API routes. Respeita Row Level Security - cada
// pessoa só vê/edita os dados da sua organizacao_id, aplicado pelas policies
// das tabelas (ver create_tables_cockpit.sql), não por filtros no código.
export async function sbUserServer() {
  const cookieStore = await cookies();
  const cfg = configSb(cookieStore.get(COOKIE_CLIENTE)?.value);
  if (!cfg) throw new Error("Sem cliente escolhido.");

  return createServerClient(
    cfg.url,
    cfg.anon,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita -
            // ignorado porque o middleware já trata de refrescar a sessão.
          }
        },
      },
    }
  );
}
