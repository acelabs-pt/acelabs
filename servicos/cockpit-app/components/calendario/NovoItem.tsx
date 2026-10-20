"use client";

import { useState } from "react";
import { isoDataLocal } from "@/lib/datas";

export type NovoValores = { titulo: string; tipo: "tarefa" | "evento"; inicio: string | null; fim: string | null };

// Janela para criar uma tarefa ou marcação. "inicial" vem do espaço onde se tocou no calendário.
export default function NovoItem({
  inicial,
  onFechar,
  onCriar,
}: {
  inicial: Date;
  onFechar: () => void;
  onCriar: (v: NovoValores) => Promise<void>;
}) {
  const temHora = inicial.getHours() !== 0 || inicial.getMinutes() !== 0;
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"tarefa" | "evento">("evento");
  const [data, setData] = useState(isoDataLocal(inicial));
  const [diaInteiro, setDiaInteiro] = useState(false);
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const [ini, setIni] = useState(temHora ? hh(inicial) : "09:00");
  const [fim, setFim] = useState(temHora ? hh(new Date(inicial.getTime() + 3600000)) : "10:00");
  const [aGuardar, setAGuardar] = useState(false);
  const campo = "w-full rounded-xl border border-black/10 px-3 py-2.5 text-base";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !data) return;
    setAGuardar(true);
    const comHora = (h: string) => new Date(`${data}T${h}`).toISOString();
    await onCriar({
      titulo: titulo.trim(),
      tipo,
      inicio: diaInteiro ? new Date(`${data}T00:00`).toISOString() : comHora(ini),
      fim: !diaInteiro && tipo === "evento" && fim > ini ? comHora(fim) : null,
    });
    setAGuardar(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-tinta">Novo</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 text-2xl leading-none text-secundario">
            &times;
          </button>
        </div>
        <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" required className={campo} />
        <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
          {([["evento", "Marcação"], ["tarefa", "Tarefa"]] as const).map(([v, r]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTipo(v)}
              className={`flex-1 rounded-lg py-1.5 ${tipo === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className={campo} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} />
          Dia inteiro
        </label>
        {!diaInteiro && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-secundario">
              {tipo === "evento" ? "Início" : "Hora"}
              <input type="time" value={ini} onChange={(e) => setIni(e.target.value)} required className={`${campo} mt-1 text-tinta`} />
            </label>
            {tipo === "evento" && (
              <label className="block text-xs text-secundario">
                Fim
                <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} className={`${campo} mt-1 text-tinta`} />
              </label>
            )}
          </div>
        )}
        <button type="submit" disabled={aGuardar || !titulo.trim()} className="w-full rounded-xl bg-azul py-3 text-base font-semibold text-white disabled:opacity-50">
          Adicionar
        </button>
      </form>
    </div>
  );
}
