// Service worker mínimo: torna a app instalável e dá um ecrã "sem rede".
// Não guarda respostas do Supabase em cache; só a página de "sem rede". Essa página mostra a
// lista do dia que o Dashboard guarda no telemóvel (lib/semRede.ts), apagada ao sair.
// Ao mudar offline.html, subir a VERSAO para os telemóveis instalados a voltarem a guardar.
const VERSAO = "cockpit-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.mode !== "navigate") return;
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});

// Notificações push (lib/push.ts subscreve; app/api/push e supabase/functions/enviar-lembretes enviam).
// O payload é JSON { titulo, corpo, url, tag }. No iPhone cada push TEM de mostrar uma notificação:
// se o service worker recebe um push e não mostra nada, o Safari acaba por cancelar a subscrição.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { corpo: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || "Cockpit", {
      body: d.corpo || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/dashboard" },
    })
  );
});

// Tocar na notificação abre (ou traz para a frente) a app no ecrã certo.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/dashboard";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
