import { createBrowserClient } from "@supabase/ssr";

// Cliente para o lado do browser (login, registo, mutações a partir de
// componentes de cliente). Usa a anon key - a segurança real vem das
// policies de RLS, não daqui.
// Com vários clientes num só deploy, o layout escreve em window.__COCKPIT_SB o Supabase do cliente escolhido
// (só endereço e chave pública). Sem isso, usa as variáveis fixas do build.
export function sbBrowser() {
  const c = typeof window !== "undefined" ? (window as unknown as { __COCKPIT_SB?: { url: string; anon: string } }).__COCKPIT_SB : undefined;
  return createBrowserClient(
    c?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    c?.anon ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
