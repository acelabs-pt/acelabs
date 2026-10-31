"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/crm/compradores", label: "Compradores" },
  { href: "/crm/proprietarios", label: "Proprietários" },
];

export default function CrmTabs() {
  const pathname = usePathname();
  if (pathname === "/crm") return null; // na entrada do CRM os dois cartões grandes fazem de separadores
  return (
    <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex-1 rounded-lg px-3 py-1.5 text-center ${
            pathname?.startsWith(t.href) ? "bg-white text-tinta shadow-sm" : "text-tinta/70"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
