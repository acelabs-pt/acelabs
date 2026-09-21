import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// A secção /cpcv/** (e as suas API routes) tem o seu próprio gate, por sessão
// individual via Supabase Auth - não usa a password partilhada do resto do
// painel. Ver cpcv-engine/README.md, secção "Autenticação simples por
// cookie": este é o "segundo gate" ali sugerido, aqui implementado com
// contas reais em vez de uma segunda password, porque há dois roles
// distintos (agente / gestora) com acessos diferentes.
//
// x-pathname é propagado em todas as respostas para o RootLayout (app/layout.tsx)
// saber, do lado do servidor, se está numa rota /cpcv e não meter a sidebar
// genérica por cima (bug apanhado ao testar: com as duas sessões activas ao
// mesmo tempo, a AppLayout genérica aparecia também nas páginas /cpcv).

const CPCV_PUBLIC_PATHS = ["/cpcv/login", "/cpcv/registo", "/api/cpcv/registo"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (pathname.startsWith("/cpcv") || pathname.startsWith("/api/cpcv")) {
    return cpcvMiddleware(req, requestHeaders);
  }

  // Rotas publicas do painel genérico
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = req.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET ?? "authenticated";

  if (token !== secret) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function cpcvMiddleware(req: NextRequest, requestHeaders: Headers) {
  const isPublic = CPCV_PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (e não getSession()) porque valida o token contra o servidor Supabase
  // em vez de só ler o cookie - importante num middleware que faz de gate de acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    // Rotas de API nunca devem ser redireccionadas para uma página HTML - o
    // frontend faz sempre res.json() na resposta, e um redirect para /cpcv/login
    // devolve 200 com HTML, o que rebenta esse parse em vez de mostrar um erro
    // limpo de "sessão expirada" (apanhado a testar sessão expirada a meio de
    // uma acção).
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = "/cpcv/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
