import type { CapacitorConfig } from "@capacitor/cli";

// Wrapper nativo em vez de PWA pura (ver pesquisa-boas-praticas.md, secção 1):
// push notifications fiáveis e acesso nativo a câmara/GPS exigem Capacitor,
// não só o browser. Em desenvolvimento e logo após o primeiro deploy, server.url
// aponta para a app Next.js publicada (padrão "hosted web app" do Capacitor) -
// mais simples do que fazer export estático de uma app com API routes. Trocar
// para a app em produção (ex: https://cockpit.acelabs.pt) antes de gerar builds
// para TestFlight/APK.
const config: CapacitorConfig = {
  appId: "pt.acelabs.cockpit",
  appName: "Cockpit",
  webDir: "public",
  server: {
    url: process.env.COCKPIT_APP_URL ?? "http://localhost:3000",
    cleartext: true,
  },
};

export default config;
