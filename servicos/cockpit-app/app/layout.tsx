import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegistarSw from "@/components/RegistarSw";

export const metadata: Metadata = {
  title: "Cockpit",
  description: "Organização do negócio do consultor imobiliário",
  appleWebApp: { capable: true, title: "Cockpit", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0071e3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans">
        {children}
        <RegistarSw />
      </body>
    </html>
  );
}
