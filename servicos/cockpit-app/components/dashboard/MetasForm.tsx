"use client";

import { useState } from "react";
import { calcular, fmtNum, type Metas } from "@/lib/metricas";

type Txt = string;
const num = (v: Txt): number | null => (v.trim() === "" || isNaN(Number(v)) || Number(v) < 0 ? null : Number(v));
const txt = (n: number | null): Txt => (n == null ? "" : String(n));

const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base";

// Fora do formulário: se fosse definida lá dentro, o campo era recriado a cada algarismo e perdia o foco.
function Linha({ rotulo, valor, onChange, ajuda }: { rotulo: string; valor: string; onChange: (v: string) => void; ajuda?: string }) {
  return (
    <label className="block text-xs text-secundario">
      {rotulo}
      <input type="number" inputMode="decimal" min={0} value={valor} onChange={(e) => onChange(e.target.value)} className={`${campo} mt-1 text-tinta`} />
      {ajuda && <span className="mt-0.5 block text-[11px]">{ajuda}</span>}
    </label>
  );
}

// Metas anuais com a calculadora do desenho: as metas de Transações e Angariações mais as taxas de
// conversão propõem as de Visitas e Reuniões (que podem ser alteradas à mão).
export default function MetasForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial: Metas;
  onGuardar: (m: Metas) => Promise<void>;
  onCancelar: () => void;
}) {
  const [trans, setTrans] = useState(txt(inicial.anual.transacoes));
  const [angs, setAngs] = useState(txt(inicial.anual.angariacoes));
  const [vPorT, setVPorT] = useState(txt(inicial.visitasPorTransacao));
  const [rPorA, setRPorA] = useState(txt(inicial.reunioesPorAngariacao));
  const [visitas, setVisitas] = useState(txt(inicial.anual.visitas));
  const [reunioes, setReunioes] = useState(txt(inicial.anual.reunioes_angariacao));
  const [fatur, setFatur] = useState(txt(inicial.faturacaoAnual));
  const [semanas, setSemanas] = useState(String(inicial.semanasUteis));
  // enquanto não se escreve à mão, visitas e reuniões seguem a calculadora
  const [visitasManual, setVisitasManual] = useState(inicial.anual.visitas != null);
  const [reunioesManual, setReunioesManual] = useState(inicial.anual.reunioes_angariacao != null);
  const [aGuardar, setAGuardar] = useState(false);

  const calc = calcular(num(trans), num(angs), num(vPorT), num(rPorA));
  const visitasMostradas = visitasManual ? visitas : txt(calc.visitas);
  const reunioesMostradas = reunioesManual ? reunioes : txt(calc.reunioes);
  const sem = Math.min(52, Math.max(1, num(semanas) ?? 52));

  const porPeriodo = (anual: string) => {
    const n = num(anual);
    return n == null ? null : `${fmtNum(n / 12)} por mês · ${fmtNum(n / sem)} por semana`;
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAGuardar(true);
        await onGuardar({
          ano: inicial.ano,
          semanasUteis: sem,
          faturacaoAnual: num(fatur),
          anual: {
            visitas: num(visitasMostradas),
            reunioes_angariacao: num(reunioesMostradas),
            angariacoes: num(angs),
            transacoes: num(trans),
          },
          visitasPorTransacao: num(vPorT),
          reunioesPorAngariacao: num(rPorA),
        });
        setAGuardar(false);
      }}
      className="space-y-4"
    >
      <p className="text-xs text-secundario">Metas para {inicial.ano}. Começa pelas vendas que queres fazer: a app calcula as visitas e reuniões que isso exige.</p>

      <Linha rotulo="Objetivo de faturação no ano (€)" valor={fatur} onChange={setFatur} ajuda="O teu objetivo máximo. As metas abaixo são o caminho até lá." />

      <div className="grid grid-cols-2 gap-3">
        <Linha rotulo="Transações no ano" valor={trans} onChange={setTrans} />
        <Linha rotulo="Angariações no ano" valor={angs} onChange={setAngs} />
        <Linha rotulo="Visitas por cada transação" valor={vPorT} onChange={setVPorT} ajuda="A tua média real." />
        <Linha rotulo="Reuniões por cada angariação" valor={rPorA} onChange={setRPorA} ajuda="A tua média real." />
      </div>

      <div className="space-y-3 rounded-xl bg-black/[0.04] p-3">
        <p className="text-xs font-semibold text-tinta">Calculado a partir das taxas (podes alterar)</p>
        <Linha
          rotulo="Visitas no ano"
          valor={visitasMostradas}
          onChange={(v) => {
            setVisitasManual(true);
            setVisitas(v);
          }}
          ajuda={porPeriodo(visitasMostradas) ?? undefined}
        />
        <Linha
          rotulo="Reuniões de angariação no ano"
          valor={reunioesMostradas}
          onChange={(v) => {
            setReunioesManual(true);
            setReunioes(v);
          }}
          ajuda={porPeriodo(reunioesMostradas) ?? undefined}
        />
      </div>

      <Linha rotulo="Semanas de trabalho por ano" valor={semanas} onChange={setSemanas} ajuda="Desconta férias para a meta semanal refletir as semanas em que trabalhas." />

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-xl bg-black/5 py-2.5 text-sm font-medium">
          Cancelar
        </button>
        <button type="submit" disabled={aGuardar} className="flex-1 rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {aGuardar ? "A guardar..." : "Guardar metas"}
        </button>
      </div>
    </form>
  );
}
