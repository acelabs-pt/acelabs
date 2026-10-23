"use client";

import CampoPesquisa from "@/components/CampoPesquisa";

// Pesquisa sempre à vista e um botão "Filtros" que abre o resto. No telemóvel os filtros todos juntos
// ocupavam quase o ecrã inteiro e empurravam a lista para baixo. O número diz quantos filtros estão ativos.
export default function BarraPesquisaFiltros({
  pesquisa,
  onPesquisa,
  aberto,
  onAlternar,
  nAtivos,
}: {
  pesquisa: string;
  onPesquisa: (v: string) => void;
  aberto: boolean;
  onAlternar: () => void;
  nAtivos: number;
}) {
  const realce = aberto || nAtivos > 0;
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <CampoPesquisa valor={pesquisa} onChange={onPesquisa} />
      </div>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ${
          realce ? "border-azul bg-azul-suave text-azul-escuro" : "border-black/10 bg-white text-tinta"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
          <circle cx="16" cy="7" r="2.5" />
          <circle cx="8" cy="17" r="2.5" />
        </svg>
        Filtros
        {nAtivos > 0 && <span className="rounded-full bg-azul px-1.5 text-[11px] font-semibold text-white">{nAtivos}</span>}
      </button>
    </div>
  );
}
