import { fmtNum } from "@/lib/metricas";

export type MetricaAnel = { rotulo: string; feito: number; meta: number | null; cor: string };

// Anéis concêntricos, do exterior para o interior. Cada anel é uma métrica: o arco mostra quanto do objetivo
// do período já foi feito. A legenda ao lado tem sempre os números, por isso a cor nunca é a única pista.
export default function AneisAtividade({ metricas, tamanho = 200 }: { metricas: MetricaAnel[]; tamanho?: number }) {
  const traco = 12;
  const folga = 4.5;
  const c = tamanho / 2;
  const r0 = c - traco / 2 - 2;
  const cumpridas = metricas.filter((m) => m.meta != null && m.meta > 0 && m.feito >= m.meta).length;
  const comMeta = metricas.filter((m) => m.meta != null && m.meta > 0).length;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <svg
          width={tamanho}
          height={tamanho}
          viewBox={`0 0 ${tamanho} ${tamanho}`}
          role="img"
          aria-label={`Metas do período: ${metricas.map((m) => `${m.rotulo} ${m.feito}${m.meta != null ? ` de ${fmtNum(m.meta)}` : ""}`).join(", ")}`}
        >
          {metricas.map((m, i) => {
            const r = r0 - i * (traco + folga);
            const frac = m.meta != null && m.meta > 0 ? Math.min(1, m.feito / m.meta) : 0;
            return (
              <g key={m.rotulo}>
                <circle cx={c} cy={c} r={r} fill="none" stroke={m.cor} strokeOpacity={0.13} strokeWidth={traco} />
                {frac > 0 && (
                  <circle
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={m.cor}
                    strokeWidth={traco}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray={`${frac} 1`}
                    transform={`rotate(-90 ${c} ${c})`}
                    className="anim-anel"
                    style={{ ["--f" as string]: frac, animationDelay: `${i * 90}ms` }}
                  />
                )}
              </g>
            );
          })}
          <text x={c} y={c} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight={700} fill="#1d1d1f" style={{ letterSpacing: "-0.03em" }}>
            {comMeta > 0 ? `${cumpridas}/${comMeta}` : "-"}
          </text>
        </svg>
        <p className="text-xs text-secundario">{comMeta > 0 ? "metas cumpridas" : "sem metas definidas"}</p>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-3.5">
        {metricas.map((m) => {
          const tem = m.meta != null && m.meta > 0;
          const pct = tem ? Math.round((m.feito / m.meta!) * 100) : null;
          return (
            <li key={m.rotulo} className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: m.cor }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight text-tinta">{m.rotulo}</p>
                <p className="text-xs text-secundario">{tem ? `${pct}% de ${fmtNum(m.meta!)}` : "sem meta definida"}</p>
              </div>
              <p className="shrink-0 text-2xl font-bold tracking-tight text-tinta">{m.feito}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
