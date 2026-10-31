"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSwipeNav } from "@/components/gestos/useGestos";

const ORDEM = ["/crm/compradores", "/crm/proprietarios"];

// Deslizar a lista de lado muda entre Compradores e Proprietários. Só nas duas listas (não nas fichas nem nos formulários).
export default function CrmSwipe({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const i = ORDEM.indexOf(pathname);
  const nav = useSwipeNav((sentido) => {
    const j = i + sentido;
    if (i >= 0 && j >= 0 && j < ORDEM.length) router.push(ORDEM[j]);
  });
  return (
    <div className="space-y-4" {...(i >= 0 ? nav : {})}>
      {children}
    </div>
  );
}
