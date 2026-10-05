"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Ícone + texto sempre visível (não só ícone) - o público não é muito
// tech-savvy, o texto evita ambiguidade (ver pesquisa-ux-design.md).
const TABS = [
  {
    href: "/hoje",
    label: "Hoje",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: "/contactos",
    label: "Contactos",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    href: "/imoveis",
    label: "Imóveis",
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M9 21v-4h6v4" />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2" />
      </>
    ),
  },
  {
    href: "/afazer",
    label: "A fazer",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12l3 3 6-6" />
      </>
    ),
  },
] as const;

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const ativo = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium ${
              ativo ? "text-azul" : "text-secundario"
            }`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.icon}
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
