"use client";

import dynamic from "next/dynamic";
import type { Layout, Data, Config } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
}

const BASE_LAYOUT: Partial<Layout> = {
  paper_bgcolor: "#FFFFFF",
  plot_bgcolor: "#FAFBFC",
  font: { family: "Inter, sans-serif", color: "#64748B" },
  margin: { t: 40, b: 32, l: 52, r: 16 },
  showlegend: true,
  legend: { orientation: "h", y: -0.18, font: { size: 10.5 } },
  xaxis: { gridcolor: "#EFF2F7", linecolor: "#E2E8F0", zerolinecolor: "#E2E8F0", tickfont: { size: 10 } },
  yaxis: { gridcolor: "#EFF2F7", linecolor: "#E2E8F0", zerolinecolor: "#E2E8F0", tickfont: { size: 10 } },
};

export default function PlotlyChart({ data, layout, config, className }: PlotlyChartProps) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden ${className ?? ""}`}>
      <Plot
        data={data}
        layout={{ ...BASE_LAYOUT, ...layout }}
        config={{ displayModeBar: false, responsive: true, ...config }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
