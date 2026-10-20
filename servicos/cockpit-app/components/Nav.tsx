"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mesmas 4 áreas do desenho da app. Em telemóvel é uma barra fixa em baixo,
// com ícone + texto sempre visível; em ecrã largo passa a barra lateral.
const ITENS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
  },
  {
    href: "/crm",
    label: "CRM",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    href: "/angariacoes",
    label: "Angariações",
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M9 21v-4h6v4" />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2" />
      </>
    ),
  },
  {
    href: "/calendario",
    label: "Calendário",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="print:hidden fixed inset-x-0 bottom-0 z-10 flex border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-56 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-3">
      <p className="hidden px-3 pb-4 pt-2 text-xl font-semibold text-tinta md:block">Cockpit</p>
      {ITENS.map((item) => {
        const ativo = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${
              ativo ? "text-azul md:bg-azul/10" : "text-secundario md:hover:bg-black/5"
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
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
