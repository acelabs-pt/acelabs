import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import RegistarSw from "@/components/RegistarSw";
import PonteNativa from "@/components/PonteNativa";
import BloqueioFaceId from "@/components/BloqueioFaceId";
import { COOKIE_CLIENTE, configSb, modoVariosClientes } from "@/lib/clientes";

export const metadata: Metadata = {
  title: "Cockpit",
  description: "Organização do negócio do consultor imobiliário",
  appleWebApp: { capable: true, title: "Cockpit", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

// Corre antes de qualquer conteúdo: na app nativa, com Face ID ligado, marca a página como bloqueada (o CSS esconde tudo)
// até o BloqueioFaceId desbloquear. Sem isto o ecrã ficava visível até o React hidratar.
const ANTES_DE_HIDRATAR =
  '(function(){try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()&&localStorage.getItem("cockpit-faceid")!=="0"&&!/^\\/(login|recuperar|nova-password|cliente|convite)/.test(location.pathname))document.documentElement.setAttribute("data-bloqueado","1")}catch(e){}})();';

export const viewport: Viewport = {
  themeColor: "#0071e3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// O cliente escolhido vem de um cookie, por isso nenhuma página pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Com vários clientes num deploy, os componentes de browser precisam de saber qual é o Supabase do cliente escolhido.
  // Só endereço e chave pública (anon), que de qualquer forma já vão para o browser.
  const varios = modoVariosClientes();
  const cfg = varios ? configSb((await cookies()).get(COOKIE_CLIENTE)?.value) : null;
  const inicio = varios
    ? `window.__COCKPIT_VARIOS=true;${cfg ? `window.__COCKPIT_SB=${JSON.stringify(cfg).replace(/</g, "\\u003c")};` : ""}`
    : "";
  return (
    <html lang="pt-PT">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTES_DE_HIDRATAR }} />
        {inicio && <script dangerouslySetInnerHTML={{ __html: inicio }} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans">
        {children}
        <RegistarSw />
        <PonteNativa />
        <BloqueioFaceId />
      </body>
    </html>
  );
}
