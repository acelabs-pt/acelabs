"use client";

import { useState } from "react";
import { DISTRITOS, concelhosDe, etiquetaLocal, freguesiasDe, type Local } from "@/lib/localizacoes";

const SELECT = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base disabled:opacity-50";

const mesmaZona = (a: Local, b: Local) =>
  a.distrito === b.distrito && (a.concelho ?? "") === (b.concelho ?? "") && (a.freguesia ?? "") === (b.freguesia ?? "");

// Várias zonas de procura. Escolhe distrito (e, se quiseres, concelho e freguesias) e carrega em "Adicionar".
// Só distrito = distrito inteiro. Com concelho e nenhuma freguesia marcada = concelho inteiro.
// Marcando freguesias, entra uma zona por freguesia.
export default function SeletorLocalizacoes({
  valor,
  onChange,
}: {
  valor: Local[];
  onChange: (v: Local[]) => void;
}) {
  const [distrito, setDistrito] = useState("");
  const [concelho, setConcelho] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);

  const freguesias = freguesiasDe(distrito, concelho);

  function adicionar() {
    if (!distrito) return;
    const novas: Local[] = marcadas.length
      ? marcadas.map((f) => ({ distrito, concelho, freguesia: f }))
      : [concelho ? { distrito, concelho } : { distrito }];
    onChange([...valor, ...novas.filter((n) => !valor.some((z) => mesmaZona(z, n)))]);
    setDistrito("");
    setConcelho("");
    setMarcadas([]);
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-secundario">Zonas de procura</span>

      {valor.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {valor.map((z, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-azul/10 py-1 pl-3 pr-1 text-sm text-azul-escuro">
              {etiquetaLocal(z)}
              <button
                type="button"
                onClick={() => onChange(valor.filter((_, j) => j !== i))}
                aria-label={`Tirar ${etiquetaLocal(z)}`}
                className="px-2 text-base leading-none"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secundario">Ainda sem zonas.</p>
      )}

      <div className="space-y-2 rounded-xl border border-black/10 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            aria-label="Distrito"
            value={distrito}
            onChange={(e) => {
              setDistrito(e.target.value);
              setConcelho("");
              setMarcadas([]);
            }}
            className={SELECT}
          >
            <option value="">Distrito</option>
            {DISTRITOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Concelho"
            value={concelho}
            disabled={!distrito}
            onChange={(e) => {
              setConcelho(e.target.value);
              setMarcadas([]);
            }}
            className={SELECT}
          >
            <option value="">Concelho (todos)</option>
            {concelhosDe(distrito).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {concelho && (
          <fieldset className="space-y-1">
            <legend className="text-xs text-secundario">
              Freguesias (se não marcares nenhuma, entra o concelho todo)
            </legend>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-black/[0.03] p-2">
              {freguesias.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-tinta">
                  <input
                    type="checkbox"
                    checked={marcadas.includes(f)}
                    onChange={(e) => setMarcadas((m) => (e.target.checked ? [...m, f] : m.filter((x) => x !== f)))}
                  />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button
          type="button"
          onClick={adicionar}
          disabled={!distrito}
          className="w-full rounded-xl bg-black/5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Adicionar zona
        </button>
      </div>
    </div>
  );
}
