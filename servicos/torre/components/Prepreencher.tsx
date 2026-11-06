"use client";

import { useEffect } from "react";

export type Pistas = {
  /** fornecedor -> última categoria usada */
  categoriaDe: Record<string, string>;
  /** débito direto -> o que já se sabe dele */
  debito: Record<string, { categoria_id: string | null; entidade_id: string | null; conta_id: string | null; valor: string | null }>;
};

/**
 * Preenche o que se adivinha a partir de uma escolha, sem apagar o que a pessoa já escreveu: escolher o fornecedor traz a
 * categoria que se usou da última vez; escolher um débito direto traz fornecedor, categoria, conta e valor.
 */
export default function Prepreencher({ pistas, raiz }: { pistas: Pistas; raiz: string }) {
  useEffect(() => {
    const el = document.getElementById(raiz);
    if (!el) return;
    const campo = <T extends HTMLInputElement | HTMLSelectElement>(nome: string) => el.querySelector<T>(`[name="${nome}"]`);
    const preencher = (nome: string, valor: string | null | undefined) => {
      const c = campo(nome);
      if (c && valor && !c.value) {
        c.value = valor;
        c.dispatchEvent(new Event("change", { bubbles: true }));
        c.classList.add("ring-2", "ring-azul/30");
        setTimeout(() => c.classList.remove("ring-2", "ring-azul/30"), 1200);
      }
    };
    const aoMudar = (e: Event) => {
      const alvo = e.target as HTMLSelectElement;
      if (alvo.name === "entidade_id") preencher("categoria_id", pistas.categoriaDe[alvo.value]);
      if (alvo.name === "subscricao_id") {
        const d = pistas.debito[alvo.value];
        if (!d) return;
        preencher("entidade_id", d.entidade_id);
        preencher("categoria_id", d.categoria_id);
        preencher("conta_id", d.conta_id);
        preencher("valor", d.valor);
      }
    };
    el.addEventListener("change", aoMudar);
    return () => el.removeEventListener("change", aoMudar);
  }, [pistas, raiz]);
  return null;
}
