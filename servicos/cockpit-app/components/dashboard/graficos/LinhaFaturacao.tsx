"use client";

import { useState } from "react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const eur = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} €`;

// Faturação acumulada no ano contra o objetivo. Três linhas: recebido (cheia, azul), objetivo
// (tracejada cinzenta, reta até ao fim do ano) e previsão ao ritmo atual (tracejada azul).
export default function LinhaFaturacao({ meses, mesAtual, objetivo }: { meses: (number | null)[]; mesAtual: number; objetivo: number }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const L = 320;
  const A = 150;
  const m = { e: 8, d: 46, t: 10, b: 22 };
  const real = mesAtual >= 0 ? (meses[mesAtual] ?? 0) : 0;
  const ritmo = mesAtual >= 0 ? real / (mesAtual + 1) : 0;
  const previsao = real + ritmo * (11 - mesAtual);
  const max = Math.max(objetivo, previsao, real, 1) * 1.08;
  const x = (i: number) => m.e + (i / 11) * (L - m.e - m.d);
  const y = (v: number) => A - m.b - (v / max) * (A - m.b - m.t);
  const metaEm = (i: number) => (objetivo * (i + 1)) / 12;

  const pontosReais = meses
    .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(" ");
  const diferenca = mesAtual >= 0 ? real - metaEm(mesAtual) : 0;
  const i = ativo ?? (mesAtual >= 0 ? mesAtual : null);

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={`Faturação acumulada: ${eur(real)} recebidos, objetivo anual ${eur(objetivo)}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * L;
          setAtivo(Math.max(0, Math.min(11, Math.round(((px - m.e) / (L - m.e - m.d)) * 11))));
        }}
        onPointerLeave={() => setAtivo(null)}
      >
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={m.e} x2={L - m.d} y1={y((max / 1.08) * f)} y2={y((max / 1.08) * f)} stroke="#0000000f" />
        ))}
        {[0, 2, 5, 8, 11].map((k) => (
          <text key={k} x={x(k)} y={A - 6} textAnchor="middle" fontSize="9" fill="#6e6e73">
            {MESES[k]}
          </text>
        ))}
        <line x1={x(0)} y1={y(metaEm(0))} x2={x(11)} y2={y(objetivo)} stroke="#6e6e73" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={x(11) + 4} y={y(objetivo)} dominantBaseline="central" fontSize="10" fill="#6e6e73">
          Objetivo
        </text>
        {mesAtual >= 0 && mesAtual < 11 && (
          <>
            <line x1={x(mesAtual)} y1={y(real)} x2={x(11)} y2={y(previsao)} stroke="#0071e3" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
            <text x={x(11) + 4} y={y(previsao) + (Math.abs(y(previsao) - y(objetivo)) < 12 ? 12 : 0)} dominantBaseline="central" fontSize="10" fill="#0059b3">
              Previsão
            </text>
          </>
        )}
        {pontosReais && <polyline points={pontosReais} fill="none" stroke="#0071e3" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={m.t} y2={A - m.b} stroke="#00000022" />}
        {i != null && i <= mesAtual && meses[i] != null && <circle cx={x(i)} cy={y(meses[i]!)} r="4.5" fill="#0071e3" stroke="#fff" strokeWidth="2" />}
      </svg>
      <p className="mt-1 min-h-[2.5rem] text-xs text-secundario" aria-live="polite">
        {i != null && meses[i] != null ? (
          <>
            <b className="text-tinta">{MESES[i]}</b>: {eur(meses[i]!)} recebidos, objetivo até aqui {eur(metaEm(i))}.
          </>
        ) : i != null ? (
          <>
            <b className="text-tinta">{MESES[i]}</b>: objetivo até aqui {eur(metaEm(i))}.
          </>
        ) : (
          "Ainda sem comissões recebidas este ano."
        )}
        {mesAtual >= 0 && (
          <span className="block">
            {diferenca >= 0 ? `Estás ${eur(diferenca)} à frente do ritmo do objetivo.` : `Estás ${eur(-diferenca)} abaixo do ritmo do objetivo.`}
          </span>
        )}
      </p>
    </div>
  );
}
