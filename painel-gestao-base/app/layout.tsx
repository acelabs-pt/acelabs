import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Painel de Gestão",
  description: "Plataforma de gestão interna",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get("auth_token");

  return (
    <html lang="pt" className={inter.variable}>
      <body className="antialiased font-sans bg-[#F4F3EF]">
        {isAuthenticated ? (
          <AppLayout>{children}</AppLayout>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
