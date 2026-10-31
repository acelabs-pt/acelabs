"use client";

import { useEffect, useState } from "react";

// Data e observações de uma visita, fechadas por defeito (só uma seta e uma linha de resumo).
// A data grava ao escolher; as observações gravam ao sair do campo.
export default function EditorVisita({
  data,
  obs,
  onData,
  onObs,
  tipo = "visita",
}: {
  tipo?: "visita" | "proposta";
  data: string;
  obs: string | null;
  onData: (d: string) => void;
  onObs: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const nome = tipo === "visita" ? "visita" : "proposta";
  const [texto, setTexto] = useState(obs ?? "");
  useEffect(() => setTexto(obs ?? ""), [obs]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 text-left"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-secundario transition-transform ${aberto ? "rotate-90" : ""}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="min-w-0 truncate text-xs text-secundario">
          {aberto ? "Fechar edição" : obs?.trim() ? obs.trim() : "Sem observações. Toca para editar"}
        </span>
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-secundario">
            Data da {nome}
            <input
              type="date"
              value={data}
              onChange={(e) => e.target.value && e.target.value !== data && onData(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-tinta"
            />
          </label>
          <label className="block text-xs text-secundario">
            Observações
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => texto !== (obs ?? "") && onObs(texto)}
              rows={2}
              placeholder={tipo === "visita" ? "Como correu a visita?" : "Detalhes da proposta"}
              className="mt-1 block w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-tinta"
            />
          </label>
        </div>
      )}
    </div>
  );
}
