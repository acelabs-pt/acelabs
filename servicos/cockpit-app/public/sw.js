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
