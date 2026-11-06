"use client";

import { useState, useTransition } from "react";
import { aplicarSempre, classificarMovimento } from "@/app/acoes";
import type { Categoria } from "@/lib/tipos";
import { useAviso } from "./Avisos";

// (lib/dados traz código só de servidor, por isso as etiquetas ficam aqui)
const ROTULO_TIPO_CATEGORIA = { custo: "Custos", proveito: "Proveitos", interno: "Movimentos internos" } as const;

/**
 * A categoria de um movimento, mudada na própria lista. Depois de classificar aparece "Aplicar sempre a ...": cria a regra
 * e classifica os outros movimentos parecidos, para não ser preciso repetir.
 */
export default function CategoriaRapida({ id, categoriaId, categorias }: { id: string; categoriaId: string | null; categorias: Categoria[] }) {
  const aviso = useAviso();
  const [valor, setValor] = useState(categoriaId ?? "");
  const [aTrabalhar, iniciar] = useTransition();
  const grupos = (["custo", "proveito", "interno"] as const).map((tipo) => ({ tipo, cats: categorias.filter((c) => c.tipo === tipo && (c.ativa || c.id === categoriaId)) }));

  function mudar(novo: string) {
    const anterior = valor;
    setValor(novo);
    iniciar(async () => {
      const r = await classificarMovimento(id, novo || null);
      if (r.erro) {
        setValor(anterior);
        aviso(r.erro);
        return;
      }
      if (!novo) return aviso("Categoria retirada.");
      const nome = categorias.find((c) => c.id === novo)?.nome ?? "";
      aviso(
        `Classificado como ${nome}.`,
        r.frase
          ? {
              texto: `Aplicar sempre a "${r.frase}"`,
              fazer: async () => {
                const x = await aplicarSempre(id);
                aviso(x.erro ?? (x.n ? `Regra criada. Mais ${x.n} ${x.n === 1 ? "movimento classificado" : "movimentos classificados"}.` : "Regra criada. Os próximos também ficam assim."));
              },
            }
          : undefined,
      );
    });
  }

  return (
    <select
      aria-label="Categoria"
      value={valor}
      disabled={aTrabalhar}
      onChange={(e) => mudar(e.target.value)}
      className={`min-h-[36px] w-full min-w-0 rounded-xl border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-azul/20 ${
        valor ? "border-transparent bg-black/[0.04] text-tinta hover:bg-black/[0.07]" : "border-ambar/40 bg-ambar-fundo text-ambar-texto"
      } ${aTrabalhar ? "opacity-60" : ""}`}
    >
      <option value="">Classificar...</option>
      {grupos.map((g) => (
        <optgroup key={g.tipo} label={ROTULO_TIPO_CATEGORIA[g.tipo]}>
          {g.cats.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
