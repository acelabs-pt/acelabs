"use client";

import Link from "next/link";
import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import { FUNIL } from "@/lib/comprador";
import { FUNIL_PROP } from "@/lib/proprietario";
import { funilComConversao, type Dados } from "@/lib/painel";

// Quantos chegaram a cada fase, que parte passa à seguinte e há quanto tempo estão parados.
// Mostra onde o negócio encrava. Tocar numa fase abre a lista já filtrada por ela.
export default function FunisConversao({ dados }: { dados: Dados }) {
  const [quem, setQuem] = useState<"compradores" | "proprietarios">("compradores");
  const e = quem === "compradores" ? funilComConversao(FUNIL, dados.compradores) : funilComConversao(FUNIL_PROP, dados.proprietarios);
  const href = quem === "compradores" ? "/crm/compradores" : "/crm/proprietarios";
  const max = Math.max(1, e.etapas[0]?.chegaram ?? 1);
  // Onde se perde mais: só conta até à proposta (compradores) ou até ao fim do funil sem o último passo (proprietários).
  // Depois do CPCV a espera pela escritura é normal e não é uma perda em que o agente possa agir.
  const limite = quem === "compradores" ? FUNIL.findIndex((f) => f.id === "cpcv") : e.etapas.length - 2;
  const comPassagem = e.etapas.filter((x, i) => i <= limite && x.passagem != null && e.etapas[i - 1].chegaram >= 3);
  const pior = comPassagem.length ? comPassagem.reduce((a, b) => (b.passagem! < a.passagem! ? b : a)) : null;

  return (
    <Cartao titulo="Funis">
      <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium" role="group" aria-label="Qual funil">
        {(
          [
            ["compradores", "Compradores"],
            ["proprietarios", "Proprietários"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            onClick={() => setQuem(v)}
            aria-pressed={quem === v}
            className={`flex-1 rounded-lg py-1.5 ${quem === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
          >
            {r}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {e.etapas.map((x) => (
          <li key={x.id}>
            <Link href={`${href}?fase=${x.id}`} className="block space-y-1 rounded-xl py-0.5 hover:bg-black/[0.03]">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-tinta">{x.label}</span>
                <span className="shrink-0 text-xs text-secundario">
                  <b className="text-sm text-tinta">{x.aqui}</b> aqui · {x.chegaram} chegaram
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-azul" style={{ width: `${(x.chegaram / max) * 100}%` }} />
              </div>
              {(x.passagem != null || x.diasParados != null) && (
                <p className="flex flex-wrap gap-x-3 text-[11px] text-secundario">
                  {x.passagem != null && (
                    <span className={pior?.id === x.id ? "font-medium text-ambar-texto" : ""}>{x.passagem}% passaram da fase anterior</span>
                  )}
                  {x.diasParados != null && (
                    <span className={x.diasParados >= 14 ? "font-medium text-ambar-texto" : ""}>parados há {x.diasParados} {x.diasParados === 1 ? "dia" : "dias"} em média</span>
                  )}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-secundario">
        {pior && (
          <>
            Onde mais se perde: <b className="text-tinta">{pior.label}</b> ({pior.passagem}% passam).{" "}
          </>
        )}
        {e.perdidos > 0 && (
          <Link href={`${href}?fase=perdido`} className="underline">
            {e.perdidos} {e.perdidos === 1 ? "perdido" : "perdidos"}
          </Link>
        )}
        {e.perdidos > 0 && " ficam de fora das percentagens, porque não se sabe em que fase caíram."}
      </p>
    </Cartao>
  );
}
