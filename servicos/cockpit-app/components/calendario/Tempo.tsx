"use client";

import { useEffect, useRef, useState } from "react";
import { HORA_PX, colocar, corItem, doDia, type Ocorrencia } from "@/lib/calendario";
import { formatarHora, mesmoDia } from "@/lib/datas";

const NOMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Grelha de horas para o Dia (1 coluna) e a Semana (7 colunas). Tocar num espaço vazio cria uma marcação
// nessa hora; os itens "dia inteiro" ficam numa faixa por cima.
export default function Tempo({
  dias,
  ocs,
  onSlot,
  onItem,
  onDia,
  onMover,
}: {
  dias: Date[];
  ocs: Ocorrencia[];
  onSlot: (d: Date) => void;
  onItem: (o: Ocorrencia) => void;
  onDia?: (d: Date) => void;
  onMover?: (id: string, d: Date) => void;
}) {
  const cont = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());
  const n = dias.length;
  const cols = `44px repeat(${n}, minmax(0, 1fr))`;

  useEffect(() => {
    const i = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    const el = cont.current;
    if (el) el.scrollTop = Math.max(0, ((dias.some((d) => mesmoDia(d, new Date())) ? new Date().getHours() : 8) - 1.5) * HORA_PX);
    // só ao abrir a vista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // Tarefas (muitas, quase sempre às 9h) não vão para a grelha, porque ficavam em tiras ilegíveis:
  // na semana viram um contador por dia (toca para abrir o dia) e no dia uma lista. Marcações com hora ficam na grelha.
  const semana = n > 1;
  const eTarefa = (o: Ocorrencia) => o.t.tipo !== "evento";
  const tarefasDoDia = dias.map((d) => doDia(ocs, d).filter(eTarefa).sort((a, b) => a.ini.getTime() - b.ini.getTime()));
  const haTarefas = tarefasDoDia.some((x) => x.length > 0);
  const diasInteiros = dias.map((d) => doDia(ocs, d).filter((o) => o.diaInteiro && !eTarefa(o)));
  const haDiaInteiro = diasInteiros.some((x) => x.length > 0);

  return (
    <div ref={cont} data-no-swipe={n > 1 ? "" : undefined} className="max-h-[68vh] overflow-auto rounded-2xl bg-white shadow-sm">
      <div style={{ minWidth: n > 1 ? 620 : 0 }}>
        <div className="sticky top-0 z-20 border-b border-black/10 bg-white">
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            <div />
            {dias.map((d) => {
              const eHoje = mesmoDia(d, agora);
              return (
                <div key={d.toISOString()} className="py-2 text-center">
                  <p className={`text-[0.6875rem] font-medium ${eHoje ? "text-azul" : "text-secundario"}`}>{NOMES[d.getDay()]}</p>
                  <p
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold ${
                      eHoje ? "bg-azul text-white" : "text-tinta"
                    }`}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>
          {haDiaInteiro && (
            <div className="grid border-t border-black/5" style={{ gridTemplateColumns: cols }}>
              <div className="px-1 py-1.5 text-right text-[0.625rem] leading-tight text-secundario">dia todo</div>
              {diasInteiros.map((x, i) => (
                <div key={i} className="space-y-0.5 border-l border-black/10 p-0.5">
                  {x.map((o) => (
                    <button
                      key={o.t.id}
                      onClick={() => onItem(o)}
                      className={`block w-full truncate rounded border-l-2 px-1 py-0.5 text-left text-[0.6875rem] ${corItem(o.t)} ${o.t.feita ? "line-through" : ""}`}
                    >
                      {o.t.titulo}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {semana && haTarefas && (
            <div className="grid border-t border-black/5" style={{ gridTemplateColumns: cols }}>
              <div className="px-1 py-1.5 text-right text-[0.625rem] leading-tight text-secundario">tarefas</div>
              {tarefasDoDia.map((x, i) => {
                const porFazer = x.filter((o) => !o.t.feita).length;
                return (
                  <div key={i} className="border-l border-black/10 p-0.5">
                    {x.length > 0 && (
                      <button
                        onClick={() => onDia?.(dias[i])}
                        className={`block w-full truncate rounded-md px-1 py-1 text-center text-[0.6875rem] font-semibold ${
                          porFazer > 0 ? "bg-verde/15 text-tinta" : "bg-black/5 text-secundario"
                        }`}
                      >
                        {porFazer > 0 ? `${porFazer} tarefa${porFazer === 1 ? "" : "s"}` : `${x.length} feita${x.length === 1 ? "" : "s"}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!semana && tarefasDoDia[0].length > 0 && (
          <ul className="space-y-1 border-b border-black/10 p-2">
            {tarefasDoDia[0].map((o) => (
              <li key={o.t.id}>
                <button
                  onClick={() => onItem(o)}
                  className={`flex w-full items-center gap-2 rounded-lg border-l-4 px-2 py-1.5 text-left text-sm ${corItem(o.t)} ${o.t.feita ? "line-through" : ""}`}
                >
                  <span className="shrink-0 text-xs opacity-70">{o.diaInteiro ? "dia todo" : formatarHora(o.t.inicio!)}</span>
                  <span className="min-w-0 truncate">{o.t.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div className="relative" style={{ height: 24 * HORA_PX }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[0.625rem] text-secundario"
                style={{ top: h * HORA_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {dias.map((d) => {
            const colocadas = colocar(doDia(ocs, d).filter((o) => !eTarefa(o)), d);
            const eHoje = mesmoDia(d, agora);
            const topoAgora = ((agora.getHours() * 60 + agora.getMinutes()) / 60) * HORA_PX;
            return (
              <div
                key={d.toISOString()}
                className="relative border-l border-black/10"
                style={{
                  height: 24 * HORA_PX,
                  backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,.07) 1px, transparent 1px)",
                  backgroundSize: `100% ${HORA_PX}px`,
                }}
                onDragOver={(e) => onMover && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onMover?.(id, d);
                }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const minutos = Math.floor((e.clientY - r.top) / HORA_PX * 2) * 30;
                  const quando = new Date(d);
                  quando.setHours(0, minutos, 0, 0);
                  onSlot(quando);
                }}
              >
                {colocadas.map(({ o, col, cols: nc, topo, altura }) => (
                  <button
                    key={o.t.id}
                    draggable={!o.t.feita && n > 1}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", o.t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItem(o);
                    }}
                    className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight ${corItem(o.t)} ${
                      o.t.feita ? "line-through" : ""
                    }`}
                    style={{
                      top: topo + 1,
                      height: altura - 2,
                      left: `calc(${(col / nc) * 100}% + 1px)`,
                      width: `calc(${100 / nc}% - 3px)`,
                    }}
                  >
                    <span className="block truncate font-medium">{o.t.titulo}</span>
                    {altura >= 36 && <span className="block text-[0.625rem] opacity-70">{formatarHora(o.t.inicio!)}</span>}
                  </button>
                ))}
                {eHoje && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-red-500" style={{ top: topoAgora }}>
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
