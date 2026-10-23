"use client";

import { useCallback, useEffect, useState } from "react";
import Hoje from "@/components/dashboard/Hoje";
import Oportunidades from "@/components/dashboard/Oportunidades";
import Metas from "@/components/dashboard/Metas";
import Atencao from "@/components/dashboard/Atencao";
import Pipeline from "@/components/dashboard/Pipeline";
import Carteira from "@/components/dashboard/Carteira";
import FunilResumo from "@/components/dashboard/FunilResumo";
import { avisos, carregarDados, type Dados } from "@/lib/painel";
import { adiarTarefa, marcarTarefa } from "@/lib/tarefas";
import AdiarFolha from "@/components/gestos/AdiarFolha";
import { usePuxarParaAtualizar } from "@/components/gestos/useGestos";
import type { Tarefa } from "@/lib/types";

export default function DashboardApp() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [adiar, setAdiar] = useState<Tarefa | null>(null);

  const carregar = useCallback(async () => {
    const r = await carregarDados();
    if (typeof r === "string") setErro(r);
    else {
      setErro(null);
      setDados(r);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternar(t: Tarefa) {
    // atualização otimista
    setDados((d) => (d ? { ...d, tarefas: d.tarefas.map((x) => (x.id === t.id ? { ...x, feita: !t.feita } : x)) } : d));
    const e = await marcarTarefa(t, !t.feita);
    if (e) {
      setErro(e);
      carregar();
    }
  }

  const puxar = usePuxarParaAtualizar(carregar);

  async function adiarPara(dia: Date) {
    const t = adiar;
    setAdiar(null);
    if (!t) return;
    const e = await adiarTarefa(t, dia);
    if (e) setErro(e);
    await carregar();
  }

  return (
    <div className="space-y-4" {...puxar.handlers}>
      <div
        className="flex items-center justify-center overflow-hidden text-xs text-secundario transition-[height] duration-150"
        style={{ height: puxar.puxar }}
        aria-live="polite"
      >
        {puxar.aAtualizar ? "A atualizar..." : puxar.puxar >= 56 ? "Solta para atualizar" : puxar.puxar > 0 ? "Puxa para atualizar" : ""}
      </div>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Dashboard</h1>
        <p className="text-sm text-secundario first-letter:uppercase">
          {new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {!dados ? (
        !erro && <p className="text-sm text-secundario">A carregar...</p>
      ) : (
        <div className="space-y-4">
          <Oportunidades />
          {/* Colunas que se enchem sem buracos; em telemóvel fica uma coluna, pela ordem de urgência. */}
          <div className="md:columns-2 md:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
            <div>
              <Hoje tarefas={dados.tarefas} onAlternar={alternar} onAdiar={setAdiar} />
            </div>
            <div>
              <Atencao avisos={avisos(dados)} />
            </div>
            <div>
              <Metas dados={dados} onAlterado={carregar} />
            </div>
            <div>
              <Pipeline dados={dados} />
            </div>
            <div>
              <Carteira dados={dados} />
            </div>
          </div>
          <FunilResumo dados={dados} />
        </div>
      )}
      {adiar && <AdiarFolha titulo={adiar.titulo} onEscolher={adiarPara} onFechar={() => setAdiar(null)} />}
    </div>
  );
}
