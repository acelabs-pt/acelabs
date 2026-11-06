import { euros } from "@/lib/dinheiro";
import { data } from "@/lib/texto";
import type { Ponto } from "@/lib/tesouraria";

/**
 * Saldo previsto dia a dia. O dinheiro muda aos saltos (um débito, uma mensalidade), por isso a linha é em degraus. SVG
 * puro, sem JavaScript: desenha-se no servidor e escala com a largura.
 */
export default function GraficoCaixa({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length < 2) return null;
  const L = 640;
  const A = 230;
  const mx = 10;
  const topo = 22;
  const base = 30;
  const vals = pontos.map((p) => p.saldo);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 1000) {
    max += 500;
    min -= 500;
  }
  const folga = (max - min) * 0.1;
  min -= folga;
  max += folga;
  const x = (i: number) => mx + (i / (pontos.length - 1)) * (L - 2 * mx);
  const y = (v: number) => topo + (1 - (v - min) / (max - min)) * (A - topo - base);

  let linha = `M ${x(0).toFixed(1)} ${y(pontos[0].saldo).toFixed(1)}`;
  for (let i = 1; i < pontos.length; i++) linha += ` L ${x(i).toFixed(1)} ${y(pontos[i - 1].saldo).toFixed(1)} L ${x(i).toFixed(1)} ${y(pontos[i].saldo).toFixed(1)}`;
  const area = `${linha} L ${x(pontos.length - 1).toFixed(1)} ${A - base} L ${x(0).toFixed(1)} ${A - base} Z`;

  const iMin = vals.indexOf(Math.min(...vals));
  const ultimo = pontos.length - 1;
  const meio = Math.floor(ultimo / 2);
  const curto = (iso: string) => data(iso).slice(0, 5);
  const negativo = Math.min(...vals) < 0;
  const resumo = `Saldo previsto de ${euros(pontos[0].saldo)} em ${data(pontos[0].dia)} a ${euros(pontos[ultimo].saldo)} em ${data(pontos[ultimo].dia)}. O ponto mais baixo é ${euros(vals[iMin])} em ${data(pontos[iMin].dia)}.`;

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={resumo} className="numero h-auto w-full">
      {min < 0 && max > 0 && <line x1={mx} x2={L - mx} y1={y(0)} y2={y(0)} stroke="#ff9f0a" strokeWidth={1.5} strokeDasharray="5 4" />}
      <path d={area} fill="rgba(0,113,227,0.10)" />
      <path d={linha} fill="none" stroke="#0071e3" strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={x(0)} cy={y(pontos[0].saldo)} r={4} fill="#0071e3" />
      <circle cx={x(ultimo)} cy={y(pontos[ultimo].saldo)} r={4} fill="#0071e3" />
      {iMin !== 0 && iMin !== ultimo && <circle cx={x(iMin)} cy={y(vals[iMin])} r={4.5} fill={negativo ? "#ff9f0a" : "#1d1d1f"} />}
      <text x={x(0) + 4} y={y(pontos[0].saldo) - 9} fontSize={12} fontWeight={600} fill="#1d1d1f">{euros(pontos[0].saldo)}</text>
      <text x={x(ultimo) - 4} y={y(pontos[ultimo].saldo) - 9} fontSize={12} fontWeight={600} fill="#1d1d1f" textAnchor="end">{euros(pontos[ultimo].saldo)}</text>
      {iMin !== 0 && iMin !== ultimo && (
        <text x={x(iMin)} y={y(vals[iMin]) + 18} fontSize={12} fontWeight={600} fill={negativo ? "#9a5b00" : "#6e6e73"} textAnchor="middle">{euros(vals[iMin])}</text>
      )}
      <text x={x(0)} y={A - 8} fontSize={11} fill="#6e6e73">{curto(pontos[0].dia)}</text>
      <text x={x(meio)} y={A - 8} fontSize={11} fill="#6e6e73" textAnchor="middle">{curto(pontos[meio].dia)}</text>
      <text x={x(ultimo)} y={A - 8} fontSize={11} fill="#6e6e73" textAnchor="end">{curto(pontos[ultimo].dia)}</text>
    </svg>
  );
}
