"use client";

import { abrirPesquisa } from "./Navegacao";

export default function BotaoPesquisa() {
  return (
    <button type="button" onClick={abrirPesquisa} aria-label="Pesquisar" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-tinta">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}
