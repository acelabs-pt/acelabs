import { NextRequest, NextResponse } from "next/server";
import { COOKIE_CLIENTE, clientePorCodigo } from "@/lib/clientes";

// Destino dos links de convite: /convite/<código do cliente>. Escolhe o cliente (cookie) e segue para o ecrã de escolher
// a password. O que vem a seguir no link (?code=...) segue junto; o fragmento (#access_token=...) o browser mantém sozinho.
export function GET(req: NextRequest, { params }: { params: { codigo: string } }) {
  const c = clientePorCodigo(params.codigo);
  const destino = req.nextUrl.clone();
  destino.pathname = c ? "/nova-password" : "/cliente";
  if (!c) destino.search = "";
  const res = NextResponse.redirect(destino);
  if (c) res.cookies.set(COOKIE_CLIENTE, c.codigo, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
