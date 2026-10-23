import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import type { Aviso } from "@/lib/painel";

// O que não se pode deixar cair. Vermelho = grave, âmbar = a acompanhar. Cada linha abre a ficha.
export default function Atencao({ avisos }: { avisos: Aviso[] }) {
  const lista = avisos.slice(0, 8);
  const graves = avisos.filter((a) => a.grave).length;
  return (
    <Cartao titulo={`Precisa de atenção${avisos.length ? ` (${avisos.length})` : ""}`}>
      {lista.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-secundario">
          <span className="h-2.5 w-2.5 rounded-full bg-verde" />
          Tudo em dia.
        </p>
      ) : (
        <>
          {graves > 0 && (
            <p className="text-sm text-secundario">
              <b className="text-red-700">{graves}</b> {graves === 1 ? "urgente" : "urgentes"}
            </p>
          )}
          <ul className="-mx-1 divide-y divide-black/[0.06]">
            {lista.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="flex items-center gap-3 rounded-xl px-1 py-3 hover:bg-black/[0.03]">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.grave ? "bg-red-600" : "bg-ambar"}`} />
                  <span className="min-w-0 flex-1 text-sm leading-snug text-tinta">{a.texto}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-secundario/60" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {avisos.length > lista.length && <p className="text-xs text-secundario">+ {avisos.length - lista.length} mais</p>}
    </Cartao>
  );
}
