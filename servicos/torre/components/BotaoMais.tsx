"use client";

import Link from "next/link";
import { useState } from "react";

// Botão "+" do telemóvel, como no Cockpit: as três coisas que mais se fazem na rua.
const ACOES = [
  { href: "/faturas?fotografar=1#caixa", titulo: "Fotografar fatura", detalhe: "O QR e a IA preenchem tudo" },
  { href: "/movimentos?novo=1", titulo: "Lançar despesa", detalhe: "Paga com dinheiro ou cartão próprio" },
  { href: "/movimentos/importar", titulo: "Importar extrato", detalhe: "CSV do banco" },
];

export default function BotaoMais() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="lg:hidden">
      {aberto && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Ações rápidas">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/30" onClick={() => setAberto(false)} />
          <ul className="anim-entrada absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 w-72 space-y-2">
            {ACOES.map((a) => (
              <li key={a.href}>
                <Link href={a.href} onClick={() => setAberto(false)} className="block rounded-2xl bg-white px-4 py-3 shadow-lg">
                  <span className="block text-base font-semibold text-tinta">{a.titulo}</span>
                  <span className="block text-sm text-secundario">{a.detalhe}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar ações rápidas" : "Ações rápidas"}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-tinta text-white shadow-lg"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden className={`transition-transform ${aberto ? "rotate-45" : ""}`}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
