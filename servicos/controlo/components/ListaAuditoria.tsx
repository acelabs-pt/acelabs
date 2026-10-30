import { dataHora, frase } from "@/lib/painel";
import type { EntradaAuditoria } from "../supabase/functions/_shared/nucleo";

export default function ListaAuditoria({ entradas }: { entradas: EntradaAuditoria[] }) {
  if (entradas.length === 0) return <p className="text-base text-secundario">Ainda não há ações registadas.</p>;
  return (
    <ul className="divide-y divide-linha rounded-3xl border border-linha bg-white">
      {entradas.map((a) => (
        <li key={a.id} className="px-5 py-3">
          <p className="text-base text-tinta">{frase(a.acao, a.detalhe)}</p>
          <p className="text-sm text-secundario">
            {a.quem} · {dataHora(a.quando)}
            {a.empresa_codigo ? ` · ${a.empresa_codigo}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
