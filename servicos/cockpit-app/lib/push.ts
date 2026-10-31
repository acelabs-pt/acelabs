import { sbBrowser } from "@/lib/supabase-browser";
import { estaInstalada } from "@/components/EstadoInstalacao";
import { desligarPushNativo, estadoPushNativo, ligarPushNativo, naApp } from "@/lib/nativo";

// Notificações push do lado do telemóvel. No iPhone (iOS 16.4 ou mais recente) só funcionam com o
// Cockpit instalado no ecrã inicial e aberto pelo ícone; o pedido de autorização tem de nascer de
// um toque num botão (nunca automático ao abrir a página).

export type EstadoPush = "nao-suportado" | "instalar-primeiro" | "bloqueado" | "desligado" | "ligado";

function eIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function chavePublica(): ArrayBuffer {
  const b64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (typeof window === "undefined") return "nao-suportado";
  if (naApp()) return estadoPushNativo(); // app da App Store: notificações nativas (APNs)
  // No iPhone, fora da app instalada, o Safari nem expõe a API de push - explicar que é preciso instalar.
  if (eIphone() && !estaInstalada()) return "instalar-primeiro";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "nao-suportado";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "nao-suportado";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "ligado" : "desligado";
}

/** Pede autorização, subscreve este aparelho e guarda-o no Supabase. Devolve uma mensagem de erro ou null. */
export async function ligarPush(): Promise<string | null> {
  if (naApp()) return ligarPushNativo();
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return "Sem autorização para notificações. Podes ativá-las nas definições do telemóvel.";
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chavePublica() });
  }
  const j = sub.toJSON();
  const { error } = await sbBrowser()
    .from("push_subscricoes")
    .upsert(
      { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, aparelho: navigator.userAgent.slice(0, 200) },
      { onConflict: "endpoint" }
    );
  return error ? "Não foi possível guardar este telemóvel. Tenta outra vez." : null;
}

export async function desligarPush(): Promise<void> {
  if (naApp()) return desligarPushNativo();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await sbBrowser().from("push_subscricoes").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
