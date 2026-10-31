import { NextResponse } from "next/server";
import webpush from "web-push";
import { sbUserServer } from "@/lib/supabase-server";

// Envia uma notificação de teste para os aparelhos do próprio utilizador (o botão "Enviar teste"
// em Conta). Usa a sessão do utilizador: as regras da tabela só lhe deixam ler os seus aparelhos,
// por isso não precisa da chave de administrador do Supabase. A chave privada VAPID fica só no
// servidor (variável VAPID_PRIVATE_KEY).
export async function POST() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    return NextResponse.json({ error: "As notificações ainda não estão configuradas neste Cockpit." }, { status: 503 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:geral@acelabs.pt", publica, privada);

  const sb = await sbUserServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { data: subs } = await sb.from("push_subscricoes").select("id, endpoint, p256dh, auth").eq("tipo", "web");
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "Este telemóvel ainda não tem as notificações ligadas." }, { status: 400 });
  }

  const payload = JSON.stringify({
    titulo: "Cockpit",
    corpo: "As notificações estão a funcionar neste telemóvel.",
    url: "/dashboard",
    tag: "teste",
  });

  let enviadas = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 });
      enviadas++;
    } catch (e) {
      // 404/410: o aparelho cancelou a subscrição (app apagada, autorização retirada) - limpar.
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sb.from("push_subscricoes").delete().eq("id", s.id);
      else console.error("Erro ao enviar notificação de teste:", e);
    }
  }
  return enviadas > 0
    ? NextResponse.json({ ok: true, enviadas })
    : NextResponse.json({ error: "Não foi possível enviar. Desliga e volta a ligar as notificações." }, { status: 502 });
}
