import Cartao from "@/components/dashboard/Cartao";
import { origens, type Dados } from "@/lib/painel";

// De que canal vêm os contactos e quantos chegam a negócio. Mostra onde vale a pena investir.
export default function Origens({ dados }: { dados: Dados }) {
  const lista = origens(dados);
  const max = Math.max(1, ...lista.map((o) => o.contactos));
  const total = lista.reduce((s, o) => s + o.contactos, 0);
  const fechados = lista.reduce((s, o) => s + o.fechados, 0);

  return (
    <Cartao titulo="De onde vêm os negócios">
      {lista.length === 0 ? (
        <p className="text-sm text-secundario">Ainda não há contactos. Escolhe o canal de origem ao criar cada comprador ou proprietário.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {lista.slice(0, 8).map((o) => (
              <li key={o.canal} className="space-y-1" role="img" aria-label={`${o.canal}: ${o.contactos} contactos, ${o.fechados} chegaram a negócio`}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-tinta">{o.canal}</span>
                  <span className="shrink-0 text-xs text-secundario">
                    <b className="text-sm text-tinta">{o.contactos}</b> {o.contactos === 1 ? "contacto" : "contactos"} ·{" "}
                    <b className="text-sm text-tinta">{o.fechados}</b> {o.fechados === 1 ? "negócio" : "negócios"}
                    {o.contactos > 0 && o.fechados > 0 ? ` (${Math.round((o.fechados / o.contactos) * 100)}%)` : ""}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-black/5">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-azul/25" style={{ width: `${(o.contactos / max) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-azul" style={{ width: `${(o.fechados / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-3 text-[11px] text-secundario">
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-azul/25" />
              Contactos
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-azul" />
              Chegaram a negócio (CPCV ou imóvel angariado)
            </span>
            <span>
              Total: {total} contactos, {fechados} negócios
            </span>
          </p>
        </>
      )}
    </Cartao>
  );
}
