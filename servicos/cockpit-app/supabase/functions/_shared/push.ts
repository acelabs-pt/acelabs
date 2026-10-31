// Envio de notificações para os dois tipos de aparelho guardados em push_subscricoes:
//  - 'web': browser ou app instalada (PWA), por Web Push (chaves VAPID);
//  - 'ios': app da App Store, diretamente à Apple (APNs, com o token do aparelho e a chave .p8 da conta Apple).
// Segredos da função: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (web) e APNS_KEY_ID, APNS_TEAM_ID,
// APNS_KEY_P8 (o conteúdo do ficheiro .p8), APNS_TOPIC (pt.acelabs.cockpit) e APNS_ENV ("production" ou "sandbox").

import webpush from "npm:web-push@3.6.7";

export type Aparelho = {
  id: string;
  tipo: "web" | "ios";
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  token: string | null;
};
export type Mensagem = { titulo: string; corpo: string; url: string; tag?: string };

let vapidPronto = false;
function prepararWebPush() {
  if (vapidPronto) return;
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:geral@acelabs.pt", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  vapidPronto = true;
}

function base64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Token de autenticação junto da Apple: JWT ES256 assinado com a chave .p8. Válido até 1 hora; guarda-se 50 minutos.
let jwtApns: { valor: string; criado: number } | null = null;
async function tokenApns(): Promise<string> {
  if (jwtApns && Date.now() - jwtApns.criado < 50 * 60_000) return jwtApns.valor;
  const pem = Deno.env.get("APNS_KEY_P8")!.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const chave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cabecalho = base64url(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }));
  const corpo = base64url(JSON.stringify({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }));
  const assinatura = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, new TextEncoder().encode(`${cabecalho}.${corpo}`)));
  jwtApns = { valor: `${cabecalho}.${corpo}.${base64url(assinatura)}`, criado: Date.now() };
  return jwtApns.valor;
}

/** Devolve "ok", "removido" (o aparelho deixou de existir: apagar o registo) ou "erro". */
export async function enviarParaAparelho(a: Aparelho, m: Mensagem): Promise<"ok" | "removido" | "erro"> {
  try {
    if (a.tipo === "ios") {
      const anfitriao = Deno.env.get("APNS_ENV") === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
      const r = await fetch(`https://${anfitriao}/3/device/${a.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${await tokenApns()}`,
          "apns-topic": Deno.env.get("APNS_TOPIC") ?? "pt.acelabs.cockpit",
          "apns-push-type": "alert",
          "apns-priority": "10",
          ...(m.tag ? { "apns-collapse-id": m.tag.slice(0, 64) } : {}),
        },
        body: JSON.stringify({ aps: { alert: { title: m.titulo, body: m.corpo }, sound: "default" }, url: m.url }),
      });
      if (r.ok) return "ok";
      const motivo = (await r.json().catch(() => ({}))).reason as string | undefined;
      // 410: a app foi apagada ou o token mudou. BadDeviceToken NÃO apaga: também aparece quando APNS_ENV está trocado
      // (sandbox contra production) e apagar o aparelho esconderia o problema.
      if (motivo === "BadDeviceToken") console.error("APNs: BadDeviceToken (confirma APNS_ENV e o APNS_TOPIC)");
      return r.status === 410 || motivo === "Unregistered" ? "removido" : "erro";
    }
    prepararWebPush();
    await webpush.sendNotification(
      { endpoint: a.endpoint!, keys: { p256dh: a.p256dh!, auth: a.auth! } },
      JSON.stringify({ titulo: m.titulo, corpo: m.corpo, url: m.url, tag: m.tag }),
      { TTL: 1800 }
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "removido" : "erro";
  }
}
