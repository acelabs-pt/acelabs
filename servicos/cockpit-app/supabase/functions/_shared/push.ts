// Envio de notificações para os três tipos de aparelho guardados em push_subscricoes:
//  - 'web': browser ou app instalada (PWA), por Web Push (chaves VAPID);
//  - 'ios': app da App Store, diretamente à Apple (APNs, com o token do aparelho e a chave .p8 da conta Apple);
//  - 'android': app Android (APK ou Google Play), pelo Firebase Cloud Messaging (FCM HTTP v1, com o token do aparelho e a
//    conta de serviço do projeto Firebase).
// Segredos da função: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (web) e APNS_KEY_ID, APNS_TEAM_ID,
// APNS_KEY_P8 (o conteúdo do ficheiro .p8), APNS_TOPIC (pt.acelabs.cockpit) e APNS_ENV ("production" ou "sandbox");
// FCM_SERVICE_ACCOUNT (o JSON da conta de serviço do Firebase, numa só variável).

import webpush from "npm:web-push@3.6.7";

export type Aparelho = {
  id: string;
  tipo: "web" | "ios" | "android";
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

// Token de acesso do Google para o FCM: troca-se um JWT RS256 (assinado com a chave da conta de serviço) por um token de 1 hora.
type ContaFcm = { project_id: string; client_email: string; private_key: string };
let tokenFcm: { valor: string; criado: number } | null = null;
function contaFcm(): ContaFcm {
  return JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!) as ContaFcm;
}
async function acessoFcm(): Promise<string> {
  if (tokenFcm && Date.now() - tokenFcm.criado < 50 * 60_000) return tokenFcm.valor;
  const c = contaFcm();
  const pem = c.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const chave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 }));
  const assinatura = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(`${cabecalho}.${corpo}`)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cabecalho}.${corpo}.${base64url(assinatura)}` }),
  });
  if (!r.ok) throw new Error(`FCM: não foi possível obter o token de acesso (${r.status})`);
  tokenFcm = { valor: (await r.json()).access_token as string, criado: Date.now() };
  return tokenFcm.valor;
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
    if (a.tipo === "android") {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${contaFcm().project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${await acessoFcm()}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token: a.token,
            notification: { title: m.titulo, body: m.corpo },
            data: { url: m.url },
            android: { priority: "HIGH", notification: { sound: "default", ...(m.tag ? { tag: m.tag.slice(0, 64) } : {}) } },
          },
        }),
      });
      if (r.ok) return "ok";
      const detalhe = await r.json().catch(() => ({}));
      const estado = detalhe?.error?.status as string | undefined;
      // UNREGISTERED: a app foi desinstalada ou o token mudou. INVALID_ARGUMENT NÃO apaga: também aparece com um token mal formado
      // ou um projeto Firebase trocado, e apagar o aparelho esconderia o problema.
      if (estado === "INVALID_ARGUMENT") console.error("FCM: INVALID_ARGUMENT (confirma o FCM_SERVICE_ACCOUNT e o google-services.json)");
      return estado === "UNREGISTERED" || r.status === 404 ? "removido" : "erro";
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
