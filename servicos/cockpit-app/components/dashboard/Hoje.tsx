"use client";

import { useState } from "react";
import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { IconeAgenda, IconeAtencao } from "@/components/dashboard/Icones";
import AngariacoesEmAtraso from "@/components/dashboard/AngariacoesEmAtraso";
import CompradoresAFazerLista, { compradoresAFazer } from "@/components/dashboard/CompradoresAFazer";
import Seguimentos, { seguimentosDe, temCliente } from "@/components/dashboard/Seguimentos";
import type { Aviso, Dados } from "@/lib/painel";
import type { Tarefa } from "@/lib/types";
import { marcarNaoFeita, reporTarefa } from "@/lib/tarefas";
import { useToast } from "@/components/Toast";
import { formatarDia, formatarHora, inicioDaSemana, inicioDoDia, somarDias } from "@/lib/datas";

// Cada secção da Agenda começa com um título a negrito, na cor da secção, com uma linha da mesma cor por baixo. O corpo fica branco.
const COR_SECAO = {
  azul: "border-azul text-azul",
  verde: "border-[#158a48] text-[#158a48]",
  ambar: "border-ambar text-ambar-texto",
} as const;
function Secao({ titulo, cor, children }: { titulo: string; cor: keyof typeof COR_SECAO; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-linha p-3 sm:p-4">
      <h3 className={`mb-2 border-b-2 pb-1.5 text-base font-bold ${COR_SECAO[cor]}`}>{titulo}</h3>
      {children}
    </div>
  );
}

type Periodo = "hoje" | "semana";
type Filtro = "todos" | "comprador" | "proprietario" | "angariacao";

const FILTROS: [Filtro, string][] = [
  ["todos", "Todos"],
  ["comprador", "Compradores"],
  ["proprietario", "Proprietários"],
  ["angariacao", "Angariações"],
];

// Dois cartões que partilham o período e o filtro: "Agenda" (hoje ou semana: marcações, tarefas e atrasos) e "Precisa de atenção".
// Tudo vem das tarefas do Calendário e dos dados do CRM, não há números à parte. "Todos" inclui também metas e tarefas criadas à mão.
export default function Hoje({ dados, avisos, aoAtualizar }: { dados: Dados; avisos: Aviso[]; aoAtualizar: () => void | Promise<void> }) {
  const { avisar } = useToast();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const inicioHoje = inicioDoDia(new Date());
  const inicio = periodo === "hoje" ? inicioHoje : inicioDaSemana(inicioHoje);
  const fim = somarDias(inicio, periodo === "hoje" ? 1 : 7);
  const abertas = dados.tarefas.filter(
    (t) => !t.feita && t.no_calendario !== false && t.inicio && (filtro === "todos" || t.origem === filtro)
  );
  const doPeriodo = abertas.filter((t) => new Date(t.inicio!) >= inicio && new Date(t.inicio!) < fim);
  const marcacoes = doPeriodo.filter((t) => t.tipo === "evento").sort((a, b) => a.inicio!.localeCompare(b.inicio!));
  // Na semana, as tarefas incluem as que ficaram em atraso (tudo o que está por fazer até ao fim da semana).
  // Os números de tarefas contam só as que estão ligadas a um cliente (as mesmas que a lista de seguimentos mostra).
  const tarefasPeriodo =
    periodo === "hoje"
      ? doPeriodo.filter((t) => t.tipo !== "evento" && temCliente(t, dados)).length
      : abertas.filter((t) => t.tipo !== "evento" && temCliente(t, dados) && new Date(t.inicio!) < fim).length;
  const emAtraso = abertas.filter((t) => t.tipo !== "evento" && temCliente(t, dados) && new Date(t.inicio!) < inicioHoje).length;
  const quando = periodo === "hoje" ? "hoje" : "na semana";
  const seguimentos = seguimentosDe(dados, periodo, filtro);
  const aFazer = compradoresAFazer(dados);
  const [verAtrasados, setVerAtrasados] = useState(false);

  // "Não feito": a tarefa em atraso já não faz sentido. Fecha-se (sem avançar o cliente no funil) e fica registada na ficha.
  async function naoFeito(t: Tarefa) {
    const e = await marcarNaoFeita(t);
    if (e) return avisar(e);
    await aoAtualizar();
    avisar("Marcada como não feita.", {
      rotulo: "Desfazer",
      onAcao: async () => {
        await reporTarefa(t);
        await aoAtualizar();
      },
    });
  }

  // Avisos: o tipo de cliente vem do início do id (c- e e-: compradores, p-: proprietários, a- e aa-: angariações).
  const tipoDoAviso = (a: Aviso): Filtro => (a.id.startsWith("p-") ? "proprietario" : a.id.startsWith("a") ? "angariacao" : "comprador");
  const doFiltro = avisos.filter((a) => filtro === "todos" || tipoDoAviso(a) === filtro);
  const listaAvisos = doFiltro.slice(0, 8);

  const numeros = [
    { n: marcacoes.length, rotulo: marcacoes.length === 1 ? `marcação ${quando}` : `marcações ${quando}`, atraso: false },
    {
      n: tarefasPeriodo,
      rotulo: periodo === "hoje" ? (tarefasPeriodo === 1 ? "tarefa para hoje" : "tarefas para hoje") : tarefasPeriodo === 1 ? "tarefa na semana, com atrasadas" : "tarefas na semana, com atrasadas",
      atraso: false,
    },
    { n: emAtraso, rotulo: "em atraso", atraso: emAtraso > 0 },
  ];

  const seletor = (
    <div className="flex rounded-[11px] bg-azul-suave p-[3px] text-sm font-medium">
      {([["hoje", "Hoje"], ["semana", "Semana"]] as const).map(([v, r]) => (
        <button
          key={v}
          type="button"
          onClick={() => setPeriodo(v)}
          aria-pressed={periodo === v}
          className={`rounded-[9px] px-3.5 py-1.5 ${periodo === v ? "bg-white font-semibold text-tinta shadow-sm" : "text-azul-escuro"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Cartao titulo="Agenda" icone={<IconeAgenda />} acao={seletor}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map(([f, r]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                aria-pressed={filtro === f}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${filtro === f ? "border-azul bg-azul text-white" : "border-azul/30 bg-white text-azul-escuro"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <Link href="/calendario" className="text-sm font-medium text-azul">
            Abrir calendário
          </Link>
        </div>

        <Secao titulo="Resumo" cor="azul">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {numeros.map((x) => (
              <div key={x.rotulo} className="rounded-[14px] border border-linha bg-white px-3 py-3 sm:px-4">
                <p className="text-3xl font-bold leading-none tracking-tight text-tinta sm:text-4xl">{x.n}</p>
                <p className={`mt-1.5 text-xs sm:text-sm ${x.atraso ? "font-semibold text-ambar-texto" : "text-secundario"}`}>{x.rotulo}</p>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo={periodo === "hoje" ? "Marcações de hoje" : "Marcações da semana"} cor="verde">
          {marcacoes.length === 0 ? (
            <p className="py-2 text-sm text-secundario">Nenhuma visita ou reunião marcada {periodo === "hoje" ? "para hoje" : "para esta semana"}.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {marcacoes.map((t) => (
                <li key={t.id}>
                  <Link href="/calendario" className="flex items-baseline gap-3 py-2.5 text-[15px] text-tinta">
                    <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[#158a48]">
                      {periodo === "semana" ? `${formatarDia(new Date(t.inicio!))} ` : ""}
                      {formatarHora(t.inicio!)}
                    </span>
                    <span className="min-w-0 truncate font-medium">{t.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {(filtro === "todos" || filtro === "comprador") && (
          <Secao titulo={`Compradores: o que fazer${aFazer.length ? ` (${aFazer.length})` : ""}`} cor="azul">
            <CompradoresAFazerLista itens={aFazer} />
          </Secao>
        )}

        <Secao titulo="Seguimentos" cor="ambar">
          {seguimentos.atrasados.length > 0 && (
            <div className="mb-2 rounded-xl border border-ambar/50 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setVerAtrasados((v) => !v)}
                aria-expanded={verAtrasados}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-bold text-ambar-texto">Em atraso ({seguimentos.atrasados.length})</span>
                <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-ambar-texto transition-transform ${verAtrasados ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {verAtrasados && (
                <div className="mt-2 rounded-lg bg-white px-3">
                  <Seguimentos dados={dados} itens={seguimentos.atrasados} vazio="" onNaoFeito={naoFeito} />
                </div>
              )}
            </div>
          )}
          <h4 className="mb-0.5 mt-1 text-sm font-bold text-tinta">
            {periodo === "hoje" ? "Para hoje" : "Até ao fim da semana"}
            {seguimentos.doPeriodo.length ? ` (${seguimentos.doPeriodo.length})` : ""}
          </h4>
          <Seguimentos
            dados={dados}
            itens={seguimentos.doPeriodo}
            vazio={periodo === "hoje" ? "Nenhum seguimento para hoje." : "Nenhum seguimento até ao fim da semana."}
          />
        </Secao>

        {filtro === "angariacao" && <AngariacoesEmAtraso dados={dados} />}
      </Cartao>

      <Cartao titulo={`Precisa de atenção${doFiltro.length ? ` (${doFiltro.length})` : ""}`} icone={<IconeAtencao />} tom="ambar">
        {listaAvisos.length === 0 ? (
          <p className="text-sm text-secundario">Tudo em dia.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {listaAvisos.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="flex items-center gap-3 py-2.5 text-[15px]">
                  <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${a.grave ? "bg-red-600" : "bg-ambar"}`} aria-hidden="true" />
                  <span className={`min-w-0 ${a.grave ? "font-semibold text-red-600" : "text-tinta"}`}>{a.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {doFiltro.length > listaAvisos.length && <p className="text-xs text-secundario">+ {doFiltro.length - listaAvisos.length} mais</p>}
      </Cartao>
    </>
  );
}
