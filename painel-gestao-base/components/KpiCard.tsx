interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delta?: number;
  deltaLabel?: string;
  today?: string;
}

export default function KpiCard({
  label,
  value,
  sub,
  color = "#2E6DB4",
  delta,
  deltaLabel,
  today,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.07)]">
      {/* Label */}
      <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[#94A3B8] mb-4">
        {label}
      </p>

      {/* Valor + badge */}
      <div className="flex items-end gap-3 mb-1">
        <p className="text-3xl font-bold text-[#0F172A] leading-none">{value}</p>
        {delta !== undefined && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full mb-0.5 ${
              delta >= 0
                ? "bg-[#ECFDF5] text-[#059669]"
                : "bg-red-50 text-red-500"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {Math.round(delta)}%
          </span>
        )}
      </div>

      {/* Sub */}
      {sub && (
        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{sub}</p>
      )}

      {/* Barra de progresso */}
      {delta !== undefined && (
        <div className="mt-5">
          <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(Math.abs(delta), 100)}%`,
                background: color,
              }}
            />
          </div>
          {(deltaLabel || today) && (
            <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1.5">
              <span>{deltaLabel ?? "Progresso"}</span>
              {today && <span className="font-semibold text-[#475569]">{today}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
