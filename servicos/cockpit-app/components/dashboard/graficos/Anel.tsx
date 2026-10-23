// Anel de progresso: feito sobre meta. A cor segue o estado (vermelho, âmbar, verde) e o valor
// escrito no centro diz sempre o número, por isso a cor nunca é a única pista.
export const corProgressoHex = (n: number, objetivo: number) => (n >= objetivo ? "#1fae5a" : n >= objetivo / 2 ? "#ff9f0a" : "#e5484d");

export default function Anel({ feito, meta, rotulo, tamanho = 72 }: { feito: number; meta: number | null; rotulo: string; tamanho?: number }) {
  const traco = 8;
  const r = (tamanho - traco) / 2;
  const c = 2 * Math.PI * r;
  const temMeta = meta != null && meta > 0;
  const frac = temMeta ? Math.min(1, feito / meta!) : 0;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      role="img"
      aria-label={temMeta ? `${rotulo}: ${feito} de ${Math.round(meta! * 10) / 10}` : `${rotulo}: ${feito}, sem meta`}
    >
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="#0000000f" strokeWidth={traco} />
      {temMeta && frac > 0 && (
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={corProgressoHex(feito, meta!)}
          strokeWidth={traco}
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
        />
      )}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={tamanho * 0.3} fontWeight={700} fill="#1d1d1f">
        {feito}
      </text>
    </svg>
  );
}
