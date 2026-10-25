"use client";

import { EsqueletoDashboard } from "@/components/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import Seguimentos from "@/components/dashboard/Seguimentos";
import Oportunidades from "@/components/dashboard/Oportunidades";
import PrimeirosPassos from "@/components/dashboard/PrimeirosPassos";
import Metas from "@/components/dashboard/Metas";
import Atencao from "@/components/dashboard/Atencao";
import Pipeline from "@/components/dashboard/Pipeline";
import Carteira from "@/components/dashboard/Carteira";
import FunisConversao from "@/components/dashboard/FunisConversao";
import Origens from "@/components/dashboard/Origens";
import { avisos, carregarDados, type Dados } from "@/lib/painel";
import { usePuxarParaAtualizar } from "@/components/gestos/useGestos";
import { guardarDia } from "@/lib/semRede";
import type { Tarefa } from "@/lib/types";

export default function DashboardApp() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await carregarDados();
    if (typeof r === "string") setErro(r);
    else {
      setErro(null);
      setDados(r);
      guardarDia(r.tarefas, (t) => telefoneDaTarefa(r, t)); // para a página sem rede
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const puxar = usePuxarParaAtualizar(carregar);

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
              {/* seguimentos a clientes da semana (versão do Miguel): cada um abre a ficha, onde se dá como feito */}
              <Seguimentos dados={dados} />
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

/** Telemóvel da pessoa a quem a tarefa diz respeito (comprador, proprietário ou contacto), se houver. */
function telefoneDaTarefa(d: Dados, t: Tarefa): string | null {
  const c = t.comprador_id ? d.compradores.find((x) => x.id === t.comprador_id) : undefined;
  if (c?.contactos.telemovel) return c.contactos.telemovel;
  const p = t.proprietario_id ? d.proprietarios.find((x) => x.id === t.proprietario_id) : undefined;
  if (p?.contactos.telemovel) return p.contactos.telemovel;
  if (t.contacto_id) {
    const k = d.compradores.find((x) => x.contacto_id === t.contacto_id) ?? d.proprietarios.find((x) => x.contacto_id === t.contacto_id);
    return k?.contactos.telemovel ?? null;
  }
  return null;
}
