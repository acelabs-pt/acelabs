import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_CLIENTE, configSb, modoVariosClientes } from "@/lib/clientes";

// Sem sessão só se pode entrar, pedir um link de recuperação ou usar o link recebido por email (convite ou recuperação).
const ROTAS_PUBLICAS = ["/login", "/recuperar", "/nova-password"];
// Não precisam de cliente escolhido: é por aqui que se escolhe (ecrã do código, ou link de convite com o código no endereço).
const ROTAS_SEM_CLIENTE = ["/cliente", "/convite"];

export async function middleware(req: NextRequest) {
  const caminho = req.nextUrl.pathname;
  if (ROTAS_SEM_CLIENTE.some((p) => caminho.startsWith(p))) return NextResponse.next();

  const cfg = configSb(req.cookies.get(COOKIE_CLIENTE)?.value);
  if (!cfg) {
    // Vários clientes e nenhum escolhido (ou código que já não existe): pede o código.
    if (modoVariosClientes()) {
      const url = req.nextUrl.clone();
      url.pathname = "/cliente";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return new NextResponse("Cockpit sem configuração: faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.", { status: 500 });
  }

  const isPublica = ROTAS_PUBLICAS.some((p) => caminho.startsWith(p));

  let response = NextResponse.next();

  const supabase = createServerClient(cfg.url, cfg.anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida o token contra o servidor Supabase, não só lê o cookie -
  // importante num middleware que faz de gate de acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Fora do login: assets estáticos e ficheiros da PWA (manifest, service worker, ícones,
  // ecrã offline) e o ficheiro dos links universais da Apple, que são pedidos sem sessão.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|\\.well-known/).*)"],
};
