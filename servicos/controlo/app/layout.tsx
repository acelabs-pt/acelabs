import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { cookieValido } from "@/lib/sessao";
import { sair } from "./acoes";
import "./globals.css";

export const metadata: Metadata = { title: "Ace Labs Controlo", robots: { index: false, follow: false } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dentro = cookieValido((await cookies()).get("controlo")?.value);
  return (
    <html lang="pt-PT">
      <body className="font-sans">
        <header className="border-b border-linha bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
            <Link href="/" className="text-base font-bold tracking-tight text-tinta">
              Ace Labs <span className="font-medium text-secundario">Controlo</span>
            </Link>
            {dentro && (
              <form action={sair}>
                <button className="rounded-full px-4 py-2 text-sm font-medium text-secundario hover:bg-black/5">Sair</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
