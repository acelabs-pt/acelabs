import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ace Labs Torre",
  robots: { index: false, follow: false },
  // Instalada no iPhone abre sem a barra do Safari e com o nome "Torre".
  appleWebApp: { capable: true, title: "Torre", statusBarStyle: "default" },
  icons: { apple: "/icones/180.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="font-sans">{children}</body>
    </html>
  );
}
