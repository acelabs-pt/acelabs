"use client";

import { usePathname } from "next/navigation";

// Largura do conteúdo: limitada em quase todas as páginas, total no calendário (ecrã largo).
export default function ConteudoShell({ children }: { children: React.ReactNode }) {
  const larga = usePathname()?.startsWith("/calendario");
  return (
    <div className={`p-4 md:p-8 print:max-w-none print:p-0 ${larga ? "" : "mx-auto max-w-5xl"}`}>{children}</div>
  );
}
