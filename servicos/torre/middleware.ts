import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// Porta de entrada da Torre: refresca a sessão em cada pedido e manda para /entrar quem não tem sessão.
// getUser() valida o token no Supabase em vez de confiar só no cookie.

const SEM_SESSAO = ["/entrar", "/redefinir"];

export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });
  const s = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(aGravar) {
        aGravar.forEach(({ name, value }) => req.cookies.set(name, value));
        resposta = NextResponse.next({ request: req });
        aGravar.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  const caminho = req.nextUrl.pathname;
  const {
    data: { user },
  } = await s.auth.getUser();
  if (SEM_SESSAO.some((p) => caminho.startsWith(p))) return resposta;

  const ir = (para: string) => {
    const url = req.nextUrl.clone();
    url.pathname = para;
    url.search = "";
    const r = NextResponse.redirect(url);
    resposta.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) return ir("/entrar");
  return resposta;
}

export const config = {
  // api/manter: o ping diário da Vercel (não lê dados, ver app/api/manter/route.ts).
  // pdf.worker.min.mjs: o leitor de PDF (código público da biblioteca pdf.js, sem dados).
  // manifest e icones: a instalação como app (o browser pede-os sem sessão; não têm dados).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/manter|pdf\\.worker\\.min\\.mjs|manifest\\.webmanifest|icones/).*)"],
};
