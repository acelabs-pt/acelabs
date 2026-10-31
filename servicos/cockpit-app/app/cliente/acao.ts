"use server";

import { cookies } from "next/headers";
import { COOKIE_CLIENTE, clientePorCodigo } from "@/lib/clientes";

export type EstadoCliente = { erro: string | null; ok?: boolean };

// Recebe o código que a pessoa escreveu. A mensagem de erro é igual para "não existe" e "mal escrito": não ajuda a adivinhar códigos.
export async function escolherCliente(_anterior: EstadoCliente, dados: FormData): Promise<EstadoCliente> {
  const c = clientePorCodigo(String(dados.get("codigo") ?? ""));
  if (!c) return { erro: "Não encontrámos esse código. Confirma com a Ace Labs." };
  const jar = await cookies();
  jar.set(COOKIE_CLIENTE, c.codigo, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  // Sem redirect do servidor: o layout raiz (que entrega ao browser o Supabase do cliente) só volta a correr numa carga completa da página.
  return { erro: null, ok: true };
}
