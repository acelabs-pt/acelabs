"use client";

import Link from "next/link";
import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import { FUNIL } from "@/lib/comprador";
import { FUNIL_PROP } from "@/lib/proprietario";
import { funilComConversao, type Dados } from "@/lib/painel";

// Um só azul: do claro (topo, muita gente) ao escuro (fundo, poucos). A cor segue a profundidade, não a categoria.
const RAMPA = ["#a9d0f6", "#82bbf1", "#5aa5ec", "#3591e8", "#0071e3", "#0066cc", "#0059b3", "#004a96", "#003d7d"];

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
            className={`flex-1 rounded-lg py-1.5 ${quem === v ? "bg-white text-tinta shadow-sm" : "text-tinta/70"}`}
          >
            {r}
          </button>
        ))}
      </div>

      <ol className="flex flex-col items-stretch">
        {e.etapas.map((x, i) => {
          const ePior = pior?.id === x.id;
          return (
            <li key={x.id}>
              {x.passagem != null && (
                <div className="flex items-center justify-center py-1.5" aria-label={`${x.passagem}% passam da fase anterior`}>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      ePior ? "bg-ambar-fundo text-ambar-texto" : "bg-black/[0.05] text-secundario"
                    }`}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 3.5l3 3 3-3" />
                    </svg>
                    {x.passagem}%
                  </span>
                </div>
              )}
              <Link href={`${href}?fase=${x.id}`} className="group block rounded-2xl px-1 py-1.5 hover:bg-black/[0.03]">
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-sm">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-tinta">
                    {x.label}
                    {x.diasParados != null && x.diasParados >= 14 && (
                      <span className="rounded-full bg-ambar-fundo px-2 py-0.5 text-[11px] font-semibold text-ambar-texto">parados há {x.diasParados} dias</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-secundario">
                    <b className="text-base font-bold tracking-tight text-tinta">{x.aqui}</b> aqui · {x.chegaram} chegaram
                  </span>
                </div>
                <div className="flex justify-center">
                  <div
                    className="anim-barra h-7 rounded-xl"
                    style={{ width: `${Math.max(8, (x.chegaram / max) * 100)}%`, backgroundColor: RAMPA[Math.min(i, RAMPA.length - 1)], animationDelay: `${i * 70}ms` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-secundario">
        {pior && (
          <>
            Onde mais se perde: <b className="text-tinta">{pior.label}</b> ({pior.passagem}% passam). O tempo parado é a média de quem está em cada fase.{" "}
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
