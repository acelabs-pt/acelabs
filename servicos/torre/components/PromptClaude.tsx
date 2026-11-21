"use client";

import { useState } from "react";

/** Botão que copia o prompt para o Claude tratar os reportes de um tester, com a opção de ver o texto antes. */
export function PromptClaude({ texto, porResolver }: { texto: string; porResolver: number }) {
  const [copiado, setCopiado] = useState(false);
  const [ver, setVer] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setVer(true); // sem acesso à área de transferência: mostra o texto para copiar à mão
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-azul-suave px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copiar}
          disabled={porResolver === 0}
          className="min-h-[44px] rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro disabled:opacity-50"
        >
          {copiado ? "Copiado" : "Copiar prompt para o Claude"}
        </button>
        <button type="button" onClick={() => setVer((v) => !v)} aria-expanded={ver} className="text-sm font-semibold text-azul-escuro">
          {ver ? "Esconder o texto" : "Ver o texto"}
        </button>
      </div>
      <p className="text-sm text-secundario">
        {porResolver === 0
          ? "Não há reportes por resolver."
          : `Leva os ${porResolver} reportes por resolver. Cola no Claude Code: ele vê as capturas, encaixa cada um no plano, corrige um a um e no fim dá-te o relatório antes e depois e a mensagem para o tester.`}
      </p>
      {ver && (
        <textarea
          readOnly
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Prompt para o Claude"
          className="h-72 w-full rounded-xl border border-linha bg-white p-3 font-mono text-sm text-tinta"
        />
      )}
    </div>
  );
}
