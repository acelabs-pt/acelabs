import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cockpit",
  description: "Gestão do dia a dia do agente imobiliário",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="font-sans">{children}</body>
    </html>
  );
}
