import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para o lado do browser (login, registo, upload de ficheiros).
// Usa a anon key - a segurança real vem das policies de RLS, não daqui.
export function sbBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
