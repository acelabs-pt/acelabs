import { createBrowserClient } from "@supabase/ssr";

// Cliente para o lado do browser (login, registo, mutações a partir de
// componentes de cliente). Usa a anon key - a segurança real vem das
// policies de RLS, não daqui.
export function sbBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
