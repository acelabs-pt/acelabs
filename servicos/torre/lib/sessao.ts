import { cache } from "react";
import { redirect } from "next/navigation";
import { sb } from "./supabase";
import type { Socio } from "./tipos";

/**
 * Quem está a usar a Torre, mesmo que ainda tenha o PIN temporário (só o layout e a ação de mudar o PIN usam isto).
 * Sem sessão vai para /entrar; uma conta que não é sócia (ou foi desativada) não passa.
 */
export const sessaoSocio = cache(async () => {
  const s = sb();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: socio } = await s.from("socios").select("*").eq("user_id", user.id).eq("ativo", true).maybeSingle();
  if (!socio) redirect("/entrar?sem-acesso=1");
  return { s, socio: socio as Socio };
});

/**
 * Todas as páginas, ações e ficheiros passam por aqui. Com o PIN ainda temporário não passa nada: volta ao ecrã onde se
 * escolhe o PIN. As regras da base de dados dizem o mesmo sobre quem é sócio; isto é para mostrar o ecrã certo em vez de
 * páginas vazias.
 */
export const exigirSocio = cache(async () => {
  const r = await sessaoSocio();
  if (r.socio.pin_temporario) redirect("/");
  return r;
});
