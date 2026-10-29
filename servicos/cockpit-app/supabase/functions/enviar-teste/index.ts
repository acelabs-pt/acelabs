// Envia uma notificação de teste para os aparelhos do utilizador que a pede (o botão "Enviar teste" em Conta).
// Publicar COM verificação de sessão (o normal): supabase functions deploy enviar-teste
// A sessão do utilizador identifica de quem são os aparelhos; a chave de administrador (já existente nas
// funções do Supabase) só serve para os ler, e nunca sai daqui.

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarParaAparelho, type Aparelho } from "../_shared/push.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sessao = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const quem = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: sessao } } });
  const { data: u } = await quem.auth.getUser();
  if (!u.user) return Response.json({ erro: "Sessão inválida." }, { status: 401, headers: CORS });

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: aparelhos } = await sb.from("push_subscricoes").select("id, tipo, endpoint, p256dh, auth, token").eq("user_id", u.user.id);
  if (!aparelhos || aparelhos.length === 0) return Response.json({ erro: "Sem aparelhos ligados." }, { status: 400, headers: CORS });

  let enviadas = 0;
  for (const a of aparelhos as Aparelho[]) {
    const r = await enviarParaAparelho(a, { titulo: "Cockpit", corpo: "As notificações estão a funcionar neste telemóvel.", url: "/dashboard", tag: "teste" });
    if (r === "ok") enviadas++;
    if (r === "removido") await sb.from("push_subscricoes").delete().eq("id", a.id);
  }
  return enviadas > 0 ? Response.json({ ok: true, enviadas }, { headers: CORS }) : Response.json({ erro: "Não foi possível enviar." }, { status: 502, headers: CORS });
});
