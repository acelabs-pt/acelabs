"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Exemplo de estrutura de navegação - substituir pelas secções reais do cliente.
const NAV = [
  {
    href: "/financeiro", label: "Financeiro",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M14.5 8.5C13.6 7.5 12.8 7 12 7c-2.2 0-3.5 2-3.5 5s1.3 5 3.5 5c.8 0 1.6-.5 2.5-1.5M8.5 11h5M8.5 13h5"/></svg>,
  },
  {
    href: "/performance", label: "Performance",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M5 20V13m4-5v12m4-8v8m4-11v11"/></svg>,
  },
  {
    href: "/clientes", label: "Clientes",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>,
  },
  {
    href: "/definicoes", label: "Definições",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#F4F3EF]">

      {/* Barra superior (mobile) */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center px-4 gap-3 bg-[#0F172A]">
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <p className="text-white font-bold text-sm tracking-wide">Painel de Gestão</p>
      </header>

      {/* Overlay (mobile) */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[280px] flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 bg-[#0F172A] ${open ? "translate-x-0" : "-translate-x-full"}`}>

        <div className="px-6 pt-8 pb-6 border-b border-white/10 flex items-start justify-between">
          <p className="text-white font-extrabold text-lg tracking-wide">Painel de Gestão</p>
          <button onClick={() => setOpen(false)} className="lg:hidden text-white/50 hover:text-white transition mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <nav className="px-4 py-5 flex-1 space-y-1.5">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}>
                <span className={active ? "text-white" : "text-white/50"}>{icon}</span>
                <span>{label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 pb-8 border-t border-white/10 pt-4">
          <button onClick={handleLogout} className="text-xs text-white/30 hover:text-white/60 transition">
            Sair da sessão
          </button>
        </div>
      </aside>

      <main className="lg:ml-[280px] min-h-screen pt-20 lg:pt-12 p-4 lg:px-8 lg:pb-8 overflow-x-hidden bg-[#F4F3EF]">
        {children}
      </main>

    </div>
  );
}
