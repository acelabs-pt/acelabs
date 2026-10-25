import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { etiquetaImovel, type Match } from "@/lib/match";

// Compradores e imóveis que cruzam e ainda não foram verificados.
export default function AlertasCompatibilidade({ matches }: { matches: Match[] }) {
  const porVerificar = matches.filter((m) => !m.confirmado);
  if (porVerificar.length === 0) return null;
  const lista = porVerificar.slice(0, 6);
  return (
    <Cartao titulo={`Compradores compatíveis (${porVerificar.length})`}>
      <ul className="space-y-1.5">
        {lista.map((m) => (
          <li key={`${m.comprador.id}:${m.proprietario.id}`}>
            <Link
              href={`/crm/compradores/${m.comprador.id}`}
              className="block rounded-lg bg-ambar-fundo px-3 py-2 text-sm text-ambar-texto"
            >
              {m.comprador.contactos.nome} com {etiquetaImovel(m)}
            </Link>
          </li>
        ))}
      </ul>
      {porVerificar.length > lista.length && <p className="text-xs text-secundario">+ {porVerificar.length - lista.length} mais</p>}
    </Cartao>
  );
}
