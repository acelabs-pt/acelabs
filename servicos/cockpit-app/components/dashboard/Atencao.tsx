import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import type { Aviso } from "@/lib/painel";

export default function Atencao({ avisos }: { avisos: Aviso[] }) {
  const lista = avisos.slice(0, 8);
  return (
    <Cartao titulo={`Precisa de atenção${avisos.length ? ` (${avisos.length})` : ""}`}>
      {lista.length === 0 ? (
        <p className="text-sm text-secundario">Tudo em dia.</p>
      ) : (
        <ul className="space-y-1.5">
          {lista.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className={`block rounded-lg px-3 py-2 text-sm ${a.grave ? "bg-red-50 text-red-700" : "bg-ambar-fundo text-ambar-texto"}`}
              >
                {a.texto}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {avisos.length > lista.length && <p className="text-xs text-secundario">+ {avisos.length - lista.length} mais</p>}
    </Cartao>
  );
}
