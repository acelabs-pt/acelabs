"use client";

import { EsqueletoDashboard } from "@/components/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import Hoje from "@/components/dashboard/Hoje";
import Oportunidades from "@/components/dashboard/Oportunidades";
import PrimeirosPassos from "@/components/dashboard/PrimeirosPassos";
import Metas from "@/components/dashboard/Metas";
import Atencao from "@/components/dashboard/Atencao";
import Pipeline from "@/components/dashboard/Pipeline";
import Carteira from "@/components/dashboard/Carteira";
import FunisConversao from "@/components/dashboard/FunisConversao";
import Origens from "@/components/dashboard/Origens";
import { avisos, carregarDados, type Dados } from "@/lib/painel";
import { adiarTarefa, marcarTarefa } from "@/lib/tarefas";
import AdiarFolha from "@/components/gestos/AdiarFolha";
import { usePuxarParaAtualizar } from "@/components/gestos/useGestos";
import { useToast } from "@/components/Toast";
import { formatarDia, inicioDoDia } from "@/lib/datas";
import type { Tarefa } from "@/lib/types";

export default function DashboardApp() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [adiar, setAdiar] = useState<Tarefa | null>(null);
  const { avisar } = useToast();

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
    if (e) setErro(e);
    else if (!t.feita) avisar("Tarefa feita.", { rotulo: "Desfazer", onAcao: () => alternar({ ...t, feita: true }) });
    // a lista só tem as primeiras tarefas: recarregar para entrar a seguinte e acertar o "+N mais"
    await carregar();
  }

  const puxar = usePuxarParaAtualizar(carregar);

  async function adiarPara(dia: Date) {
    const t = adiar;
    setAdiar(null);
    if (!t) return;
    const e = await adiarTarefa(t, dia);
    if (e) setErro(e);
    else if (t.inicio) {
      const antes = inicioDoDia(new Date(t.inicio));
      avisar(`Adiada para ${formatarDia(dia)}.`, {
        rotulo: "Desfazer",
        onAcao: async () => {
          await adiarTarefa(t, antes);
          await carregar();
        },
      });
    }
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
        {dados && <ResumoDoDia dados={dados} />}
      </div>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {!dados ? (
        !erro && <EsqueletoDashboard />
      ) : (
        <div className="space-y-4">
          <PrimeirosPassos dados={dados} />
          <Oportunidades />
          {/* Colunas que se enchem sem buracos; em telemóvel fica uma coluna, pela ordem de urgência. */}
          <div className="md:columns-2 md:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
            <div>
              <Hoje tarefas={dados.tarefas} total={dados.nHoje} onAlternar={alternar} onAdiar={setAdiar} />
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
            <div>
              <FunisConversao dados={dados} />
            </div>
            <div>
              <Origens dados={dados} />
            </div>
          </div>
        </div>
      )}
      {adiar && <AdiarFolha titulo={adiar.titulo} onEscolher={adiarPara} onFechar={() => setAdiar(null)} />}
    </div>
  );
}

function saudacao(): string {
  const h = new Date().getHours();
  return h < 6 ? "Boa noite" : h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

// Uma frase com o que importa agora: quantas tarefas e quantos avisos urgentes.
function ResumoDoDia({ dados }: { dados: Dados }) {
  const urgentes = avisos(dados).filter((a) => a.grave).length;
  const n = dados.nHoje;
  return (
    <p className="mt-3 text-base text-tinta">
      {saudacao()}.{" "}
      {n === 0 && urgentes === 0 ? (
        "Estás em dia."
      ) : (
        <>
          {n > 0 && (
            <>
              Tens <b>{n}</b> {n === 1 ? "tarefa" : "tarefas"} para hoje ou em atraso
            </>
          )}
          {n > 0 && urgentes > 0 && ", "}
          {urgentes > 0 && (
            <>
              {n === 0 && "Tens "}
              <b className="text-red-700">{urgentes}</b> {urgentes === 1 ? "aviso urgente" : "avisos urgentes"}
            </>
          )}
          .
        </>
      )}
    </p>
  );
}
