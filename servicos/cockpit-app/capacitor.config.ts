import type { CapacitorConfig } from "@capacitor/cli";

// Casca nativa do Cockpit para iPhone e Android (Capacitor). A app não leva o código web lá dentro: abre o endereço
// publicado, por isso uma correção de ecrã chega a todos sem nova revisão da Apple. Só as funções nativas
// (notificações, Face ID ou impressão digital, calendário, contactos, partilha) precisam de nova versão na loja.
// Para testar contra o computador: CAP_SERVER_URL=http://<ip do PC>:3001 npm run cap:sync (o Android aceita http por causa de cleartext).
const url = process.env.CAP_SERVER_URL || "https://cockpit.acelabs.pt";

const config: CapacitorConfig = {
  appId: "pt.acelabs.cockpit",
  appName: "Cockpit",
  // Pasta com o ecrã "sem ligação" que o iPhone mostra quando o endereço não responde.
  webDir: "capacitor/www",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    errorPath: "erro.html",
    // O Supabase de cada cliente fica noutro endereço; os pedidos fetch não precisam de estar aqui, só a navegação.
    allowNavigation: ["cockpit.acelabs.pt"],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f5f5f7",
    // Só se pode abrir endereços da própria app no WebView; links externos abrem no Safari.
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: "#f5f5f7",
    // Só sai do WebView por links da própria app; o resto abre no browser do telemóvel.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#f5f5f7", showSpinner: false },
    StatusBar: { style: "DEFAULT" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
