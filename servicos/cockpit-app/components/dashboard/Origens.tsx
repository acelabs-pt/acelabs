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
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-azul-suave p-4">
              <p className="text-3xl font-bold tracking-tight text-azul-escuro">{total}</p>
              <p className="text-sm text-tinta/70">contactos</p>
            </div>
            <div className="rounded-2xl bg-verde-suave p-4">
              <p className="text-3xl font-bold tracking-tight text-tinta">{fechados}</p>
              <p className="text-sm text-tinta/70">chegaram a negócio</p>
            </div>
          </div>

          <ul className="space-y-4">
            {lista.slice(0, 8).map((o, i) => (
              <li key={o.canal}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-tinta">{o.canal}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-secundario">
                    <b className="text-sm font-bold text-tinta">{o.contactos}</b>
                    {o.fechados > 0 && (
                      <span className="rounded-full bg-verde-suave px-2 py-0.5 font-semibold text-tinta">{Math.round((o.fechados / o.contactos) * 100)}% negócio</span>
                    )}
                  </span>
                </div>
                <div
                  className="relative h-3 overflow-hidden rounded-full bg-black/[0.05]"
                  role="img"
                  aria-label={`${o.canal}: ${o.contactos} contactos, ${o.fechados} chegaram a negócio`}
                >
                  <div
                    className="anim-barra absolute inset-y-0 left-0 rounded-full bg-azul/25"
                    style={{ width: `${(o.contactos / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                  />
                  <div
                    className="anim-barra absolute inset-y-0 left-0 rounded-full bg-azul"
                    style={{ width: `${(o.fechados / max) * 100}%`, animationDelay: `${i * 60 + 120}ms` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-4 text-[11px] text-secundario">
            <span>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-azul/25" />
              Contactos
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-azul" />
              Chegaram a negócio (CPCV ou imóvel angariado)
            </span>
          </p>
        </>
      )}
    </Cartao>
  );
}
