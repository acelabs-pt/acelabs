"use client";

import { somarDias, inicioDaSemana, mesmoDia } from "@/lib/datas";
import { corItem, doDia, type Ocorrencia } from "@/lib/calendario";
import { formatarHora } from "@/lib/datas";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

// Vista mensal: grelha de dias com marcações. Tocar num dia seleciona-o; a lista desse dia fica por baixo.
export default function Mes({
  ref_,
  ocs,
  onEscolher,
}: {
  ref_: Date;
  ocs: Ocorrencia[];
  onEscolher: (d: Date) => void;
}) {
  const primeiro = new Date(ref_.getFullYear(), ref_.getMonth(), 1);
  const inicio = inicioDaSemana(primeiro);
  const diasNoMes = new Date(ref_.getFullYear(), ref_.getMonth() + 1, 0).getDate();
  const linhas = Math.ceil((((primeiro.getDay() + 6) % 7) + diasNoMes) / 7);
  const dias = Array.from({ length: linhas * 7 }, (_, i) => somarDias(inicio, i));
  const hoje = new Date();

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-black/10 text-center text-[11px] font-medium text-secundario">
        {SEMANA.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const doMes = d.getMonth() === ref_.getMonth();
          const eHoje = mesmoDia(d, hoje);
          const sel = mesmoDia(d, ref_);
          const x = doDia(ocs, d).sort((a, b) => a.ini.getTime() - b.ini.getTime());
          const abertas = x.filter((o) => !o.t.feita).length;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onEscolher(d)}
              aria-label={`${d.getDate()}, ${x.length} itens`}
              className={`flex min-h-16 flex-col items-center gap-1 border-black/5 p-1 text-left md:min-h-28 md:items-stretch ${
                i % 7 !== 0 ? "border-l" : ""
              } ${i >= 7 ? "border-t" : ""} ${sel && !eHoje ? "bg-azul/5" : ""}`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center self-center rounded-full text-sm font-medium md:self-start ${
                  eHoje ? "bg-azul text-white" : sel ? "ring-2 ring-azul" : ""
                } ${!doMes && !eHoje ? "text-secundario/50" : "text-tinta"}`}
              >
                {d.getDate()}
              </span>

              {/* telemóvel: pontos; computador: títulos */}
              {x.length > 0 && (
                <span className="flex gap-0.5 md:hidden">
                  {x.slice(0, 3).map((o) => (
                    <span
                      key={o.t.id}
                      className={`h-1.5 w-1.5 rounded-full ${o.t.feita ? "bg-black/20" : o.t.tipo === "evento" ? "bg-azul" : "bg-verde"}`}
                    />
                  ))}
                  {abertas > 3 && <span className="text-[9px] leading-none text-secundario">+</span>}
                </span>
              )}
              <span className="hidden w-full space-y-0.5 md:block">
                {x.slice(0, 3).map((o) => (
                  <span
                    key={o.t.id}
                    className={`block truncate rounded border-l-2 px-1 py-0.5 text-[11px] ${corItem(o.t)} ${o.t.feita ? "line-through" : ""}`}
                  >
                    {!o.diaInteiro && <span className="mr-1 opacity-70">{formatarHora(o.t.inicio!)}</span>}
                    {o.t.titulo}
                  </span>
                ))}
                {x.length > 3 && <span className="block px-1 text-[11px] text-secundario">+{x.length - 3} mais</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
