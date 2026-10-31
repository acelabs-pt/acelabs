"use client";

import { useEffect } from "react";
import { naApp, pontoNoCalendario, vibrar } from "@/lib/nativo";

// Montado uma vez no layout. Só faz alguma coisa dentro da app nativa (iPhone):
// - marca a página (<html data-app="nativa">) para esconder instruções de instalar;
// - abrir um link de convite (link universal) segue para /convite/<código>;
// - tocar numa notificação abre o ecrã certo (o url vai no payload);
// - os botões "Pôr no telemóvel" (links para /api/tarefas/<id>/calendario) criam o evento na agenda do iPhone
//   em vez de descarregar um ficheiro;
// - vibração ligeira ao marcar uma tarefa como feita.
export default function PonteNativa() {
  useEffect(() => {
    if (!naApp()) return;
    document.documentElement.dataset.app = "nativa";

    const remover: Array<() => void> = [];

    void import("@capacitor/push-notifications").then(({ PushNotifications }) => {
      void PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const url = a.notification.data?.url;
        if (typeof url === "string" && url.startsWith("/")) window.location.href = url;
      })
        .then((h) => remover.push(() => void h.remove()))
        .catch(() => {}); // plugin indisponível: as notificações não abrem o ecrã certo
    }).catch(() => {});

    // Link universal (convite): a app abre, mas o WebView fica onde estava. Segue para o /convite/<código> do link, que
    // escolhe o cliente e leva ao ecrã de escolher a password. Só aceita este caminho e o nosso domínio.
    void import("@capacitor/app").then(({ App }) => {
      void App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.hostname === window.location.hostname && u.pathname.startsWith("/convite/")) window.location.href = u.pathname + u.search + u.hash;
        } catch {
          // endereço inválido: ignora
        }
      })
        .then((h) => remover.push(() => void h.remove()))
        .catch(() => {});
    }).catch(() => {});

    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      const a = alvo?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && /^\/api\/tarefas\/[^/]+\/calendario$/.test(new URL(a.href, location.href).pathname)) {
        e.preventDefault();
        void pontoNoCalendario(new URL(a.href, location.href).pathname);
        return;
      }
      if (alvo?.closest?.('button[aria-label="Marcar como feita"]')) void vibrar();
    };
    document.addEventListener("click", aoClicar, true);
    remover.push(() => document.removeEventListener("click", aoClicar, true));

    return () => remover.forEach((f) => f());
  }, []);
  return null;
}
