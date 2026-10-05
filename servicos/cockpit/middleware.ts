import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const ROTAS_PUBLICAS = ["/login"];

export async function middleware(req: NextRequest) {
  const isPublica = ROTAS_PUBLICAS.some((p) => req.nextUrl.pathname.startsWith(p));

  let response = NextResponse.next();

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
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
