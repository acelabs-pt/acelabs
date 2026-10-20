import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente ligado à sessão do utilizador autenticado (via cookies), para usar
// em Server Components e API routes. Respeita Row Level Security - cada
// pessoa só vê/edita os dados da sua organizacao_id, aplicado pelas policies
// das tabelas (ver create_tables_cockpit.sql), não por filtros no código.
export async function sbUserServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
