"use client";

import { useId, useState } from "react";
import { compacto, curvaSuave, eur } from "@/lib/graficos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Faturação acumulada no ano: área suave a desvanecer (recebido), linha do objetivo e previsão ao ritmo atual.
// Tocar ou passar o rato mostra o mês. O texto por baixo diz sempre o mês escolhido e a diferença para o objetivo.
export default function AreaFaturacao({ meses, mesAtual, objetivo }: { meses: (number | null)[]; mesAtual: number; objetivo: number }) {
  const idGrad = useId().replace(/:/g, "");
  const [ativo, setAtivo] = useState<number | null>(null);
  const L = 340;
  const A = 190;
  const m = { e: 8, d: 60, t: 22, b: 24 };
  const real = mesAtual >= 0 ? (meses[mesAtual] ?? 0) : 0;
  const ritmo = mesAtual >= 0 ? real / (mesAtual + 1) : 0;
  const previsao = real + ritmo * (11 - mesAtual);
  const max = Math.max(objetivo, previsao, real, 1) * 1.06;
  // x: de dezembro do ano anterior (zero) a dezembro
  const x = (i: number) => m.e + ((i + 1) / 12) * (L - m.e - m.d);
  const y = (v: number) => A - m.b - (v / max) * (A - m.b - m.t);
  const metaEm = (i: number) => (objetivo * (i + 1)) / 12;

  const pontos: [number, number][] = [[x(-1), y(0)]];
  meses.forEach((v, i) => {
    if (v != null) pontos.push([x(i), y(v)]);
  });
  const linha = curvaSuave(pontos);
  const area = pontos.length > 1 ? `${linha} L${pontos[pontos.length - 1][0]},${y(0)} L${pontos[0][0]},${y(0)} Z` : "";
  const diferenca = mesAtual >= 0 ? real - metaEm(mesAtual) : 0;
  const i = ativo ?? (mesAtual >= 0 ? mesAtual : null);
  const valorI = i != null ? meses[i] : null;
  const grelha = [0, 0.5, 1].map((f) => (objetivo * f));

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Faturação acumulada: ${eur(real)} recebidos, objetivo anual ${eur(objetivo)}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * L;
          setAtivo(Math.max(0, Math.min(11, Math.round(((px - m.e) / (L - m.e - m.d)) * 12 - 1))));
        }}
        onPointerLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id={`g${idGrad}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0071e3" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0071e3" stopOpacity="0" />
          </linearGradient>
        </defs>

        {grelha.map((v, k) => (
          <g key={k}>
            <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="#0000000d" strokeDasharray={k === 0 ? undefined : "2 4"} />
            {v > 0 && (
              <text x={m.e} y={y(v) - 5} textAnchor="start" fontSize="9.5" fill="#6e6e73">
                {compacto(v)}
              </text>
            )}
          </g>
        ))}
        {[0, 3, 6, 9, 11].map((k) => (
          <text key={k} x={x(k)} y={A - 6} textAnchor="middle" fontSize="10" fill="#6e6e73">
            {MESES[k]}
          </text>
        ))}

        {/* objetivo: reta do zero ao total */}
        <line x1={x(-1)} y1={y(0)} x2={x(11)} y2={y(objetivo)} stroke="#6e6e73" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.7" />
        <text x={x(11) + 6} y={y(objetivo)} dominantBaseline="central" fontSize="10.5" fontWeight={500} fill="#6e6e73">
          Objetivo
        </text>

        {/* previsão ao ritmo atual */}
        {mesAtual >= 0 && mesAtual < 11 && (
          <g className="anim-surgir" style={{ animationDelay: "500ms" }}>
            <line x1={x(mesAtual)} y1={y(real)} x2={x(11)} y2={y(previsao)} stroke="#0071e3" strokeWidth="2.25" strokeDasharray="1 5" strokeLinecap="round" />
            <text x={x(11) + 6} y={y(previsao) + (Math.abs(y(previsao) - y(objetivo)) < 13 ? 13 : 0)} dominantBaseline="central" fontSize="10.5" fontWeight={500} fill="#0059b3">
              Previsão
            </text>
          </g>
        )}

        {area && <path d={area} fill={`url(#g${idGrad})`} className="anim-surgir" />}
        {linha && pontos.length > 1 && <path d={linha} fill="none" stroke="#0071e3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="anim-linha" />}

        {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={m.t - 6} y2={A - m.b} stroke="#0000001f" />}

        {/* ponto do mês escolhido (ou do mês atual) */}
        {i != null && i <= mesAtual && valorI != null && (
          <g>
            {ativo == null && <circle cx={x(i)} cy={y(valorI)} r="5" fill="#0071e3" className="anim-pulso" />}
            <circle cx={x(i)} cy={y(valorI)} r="5.5" fill="#0071e3" stroke="#fff" strokeWidth="2.5" />
          </g>
        )}
      </svg>

      <p className="mt-1 min-h-[2.75rem] text-xs text-secundario" aria-live="polite">
        {i != null && valorI != null ? (
          <>
            <b className="text-tinta">{MESES[i]}</b>: {eur(valorI)} recebidos, objetivo até aqui {eur(metaEm(i))}.
          </>
        ) : i != null ? (
          <>
            <b className="text-tinta">{MESES[i]}</b>: objetivo até aqui {eur(metaEm(i))}.
          </>
        ) : (
          "Ainda sem comissões recebidas este ano."
        )}
        {mesAtual >= 0 && (
          <span className={`mt-0.5 block font-medium ${diferenca >= 0 ? "text-verde" : "text-ambar-texto"}`}>
            {diferenca >= 0 ? `${eur(diferenca)} à frente do ritmo do objetivo.` : `${eur(-diferenca)} abaixo do ritmo do objetivo.`}
          </span>
        )}
      </p>
    </div>
  );
}
