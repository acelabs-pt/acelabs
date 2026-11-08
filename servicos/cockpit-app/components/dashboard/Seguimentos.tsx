"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dados } from "@/lib/painel";
import type { Tarefa } from "@/lib/types";
import { tipoTarefaComprador } from "@/lib/comprador";
import { formatarDia, formatarHora, inicioDaSemana, inicioDoDia, somarDias } from "@/lib/datas";

const VISIVEIS = 6;

type Ficha = { href: string; tipo: "comprador" | "proprietario"; id: string; angariacao?: boolean };

// Ficha do cliente a que o seguimento diz respeito (comprador ou proprietário). Sem ficha, não é um seguimento.
function fichaDe(t: Tarefa, d: Dados): Ficha | null {
  if (t.comprador_id) return { href: `/crm/compradores/${t.comprador_id}`, tipo: "comprador", id: t.comprador_id };
  if (t.proprietario_id) return { href: `/crm/proprietarios/${t.proprietario_id}`, tipo: "proprietario", id: t.proprietario_id };
  if (t.angariacao_acao_id) {
    const acao = d.acoes.find((a) => a.id === t.angariacao_acao_id);
    if (!acao?.follow_up) return null; // só os follow ups ao proprietário, não as outras ações do plano
    const ang = d.angariacoes.find((a) => a.id === acao.angariacao_id);
    // o follow-up do plano da angariação marca-se na própria angariação (plano), não na ficha do proprietário
    return ang?.proprietario_id ? { href: `/angariacoes/${ang.id}`, tipo: "proprietario", id: ang.proprietario_id, angariacao: true } : null;
  }
  return null;
}

// O que há para fazer, em duas palavras (o título completo fica atrás da seta).
export function acaoDe(t: Tarefa): string {
  const x = t.titulo.toLowerCase();
  if (x.includes("follow up")) return "Follow up";
  if (x.includes("enviar opções")) return "Enviar opções";
  if (x.includes("dossier")) return "Enviar dossier";
  if (x.includes("agradecimento")) return "Agradecer";
  if (x.includes("partilhar")) return "Partilhar";
  if (x.startsWith("ligar")) return "Ligar"; // "Ligar a (nome) para marcar a reunião" é uma chamada, não a reunião
  if (x.includes("reunião")) return "Reunião";
  if (x.includes("visita")) return "Visita";
  if (x.includes("escritura")) return "Escritura";
  if (x.includes("ligar") || x.includes("seguimento") || x.includes("contactar") || x.includes("contacto")) return "Ligar";
  if (x.includes("pedir")) return "Pedir";
  return "Tarefa";
}

// Nome do cliente e, nos proprietários, o imóvel que têm (só tipologia, freguesia e concelho).
function clienteDe(f: Ficha, d: Dados): { nome: string | null; imovel: string } {
  if (f.tipo === "comprador") {
    const c = d.compradores.find((x) => x.id === f.id);
    return { nome: c?.contactos.nome ?? null, imovel: c?.motivacao != null ? `Motivação ${c.motivacao}/10` : "" };
  }
  const p = d.proprietarios.find((x) => x.id === f.id);
  return { nome: p?.contactos.nome ?? null, imovel: p ? [p.tipologia, p.freguesia, p.concelho].filter(Boolean).join(" · ") : "" };
}

/** A tarefa está ligada a um cliente (tem ficha para abrir)? As acções do plano de angariação que não são follow-ups não estão. */
export const temCliente = (t: Tarefa, d: Dados) => fichaDe(t, d) !== null && !eSemanalDeComprador(t);

// "Enviar opções de imóveis" e "Propor visita" (as tarefas semanais dos compradores) aparecem na secção "Compradores: o que fazer".
const eSemanalDeComprador = (t: Tarefa) => t.origem === "comprador" && tipoTarefaComprador(t) !== null;

export type Seguimento = { t: Tarefa; ficha: Ficha };

/**
 * Seguimentos a clientes por fazer, em dois grupos: os que ficaram para trás (antes de hoje) e os do período (hoje, ou de hoje
 * até ao fim da semana). Só entram as tarefas ligadas a uma ficha de cliente (comprador, proprietário ou follow-up de uma angariação).
 * filtro: tipo de cliente; "proprietario" inclui também os follow-ups que vêm do plano de uma angariação.
 */
export function seguimentosDe(
  dados: Dados,
  periodo: "hoje" | "semana",
  filtro: "todos" | "comprador" | "proprietario"
): { atrasados: Seguimento[]; doPeriodo: Seguimento[] } {
  const inicioHoje = inicioDoDia(new Date());
  const fim = periodo === "hoje" ? somarDias(inicioHoje, 1) : somarDias(inicioDaSemana(inicioHoje), 7);
  const motivacoes = new Map(dados.compradores.map((c) => [c.id, c.motivacao]));
  const todos = dados.tarefas
    .filter((t) => t.tipo === "tarefa" && !t.feita && t.inicio && new Date(t.inicio) < fim)
    .filter((t) => filtro === "todos" || (filtro === "proprietario" ? t.origem === "proprietario" || t.origem === "angariacao" : t.origem === filtro))
    .filter((t) => !eSemanalDeComprador(t))
    .map((t) => ({ t, ficha: fichaDe(t, dados) }))
    .filter((x): x is Seguimento => x.ficha !== null)
    .sort((a, b) => {
      // Compradores primeiro, dos mais motivados para os menos (sem motivação por último); dentro da mesma motivação, por data.
      // Os restantes (proprietários) seguem por data, depois dos compradores.
      const ma = a.ficha.tipo === "comprador" ? motivacoes.get(a.ficha.id) ?? -1 : null;
      const mb = b.ficha.tipo === "comprador" ? motivacoes.get(b.ficha.id) ?? -1 : null;
      if (ma !== null && mb !== null && ma !== mb) return mb - ma;
      if (ma !== null && mb === null) return -1;
      if (ma === null && mb !== null) return 1;
      return a.t.inicio!.localeCompare(b.t.inicio!);
    });
  return {
    atrasados: todos.filter((x) => new Date(x.t.inicio!) < inicioHoje),
    doPeriodo: todos.filter((x) => new Date(x.t.inicio!) >= inicioHoje),
  };
}

// Lista de seguimentos (dentro da Agenda), uma linha por cliente, separadas por linhas finas, com a ficha à frente.
// Sem checkbox: o seguimento dá-se como feito na própria ficha (ou no Calendário).
export default function Seguimentos({ dados, itens, vazio, onNaoFeito }: { dados: Dados; itens: Seguimento[]; vazio: string; onNaoFeito?: (t: Tarefa) => void }) {
  const [todos, setTodos] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const inicioHoje = inicioDoDia(new Date());

  // Um cliente, uma linha: todas as tarefas dele ficam juntas, atrás da seta.
  const porCliente = new Map<string, { ficha: Ficha; tarefas: Tarefa[] }>();
  const angariacaoDe = new Map<string, Ficha>();
  for (const { t, ficha } of itens) {
    const k = `${ficha.tipo}:${ficha.id}`;
    const g = porCliente.get(k) ?? { ficha, tarefas: [] };
    g.tarefas.push(t);
    porCliente.set(k, g);
    if (ficha.angariacao && !angariacaoDe.has(k)) angariacaoDe.set(k, ficha);
  }
  const grupos = [...porCliente.entries()];
  const mostradas = todos ? grupos : grupos.slice(0, VISIVEIS);

  if (itens.length === 0) return <p className="py-2 text-sm text-secundario">{vazio}</p>;
  return (
    <>
      <ul className="divide-y divide-linha">
        {mostradas.map(([chave, { ficha, tarefas }]) => {
          const cliente = clienteDe(ficha, dados);
          const varias = tarefas.length > 1;
          const atrasada = tarefas.some((t) => new Date(t.inicio!) < inicioHoje);
          const aberto = abertos.has(chave);
          return (
            <li key={chave} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={`text-[0.6875rem] font-bold ${ficha.tipo === "comprador" ? "text-azul" : "text-verde"}`}>{ficha.tipo === "comprador" ? "Comprador" : "Proprietário"}</p>
                <button
                  type="button"
                  onClick={() =>
                    setAbertos((a) => {
                      const n = new Set(a);
                      if (!n.delete(chave)) n.add(chave);
                      return n;
                    })
                  }
                  aria-expanded={aberto}
                  aria-label="Ver detalhes do seguimento"
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="min-w-0 truncate text-[0.9375rem] font-bold text-tinta">{cliente.nome ?? tarefas[0].titulo}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${atrasada ? "bg-ambar-fundo text-ambar-texto" : "bg-azul-suave text-azul-escuro"}`}>{acaoDe(tarefas[0])}</span>
                  {varias && <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-secundario">+{tarefas.length - 1}</span>}
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 shrink-0 text-secundario transition-transform ${aberto ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {cliente.imovel && <p className="truncate text-xs text-secundario">{cliente.imovel}</p>}
                {aberto && (
                  <ul className="mt-1 space-y-1">
                    {tarefas.map((t) => {
                      const emAtraso = new Date(t.inicio!) < inicioHoje;
                      return (
                        <li key={t.id} className="flex items-center gap-2 py-0">
                          <p className={`min-w-0 flex-1 text-xs ${emAtraso ? "text-ambar-texto" : "text-secundario"}`}>
                            {t.titulo} · {formatarDia(new Date(t.inicio!))}
                            {formatarHora(t.inicio!) ? ` · ${formatarHora(t.inicio!)}` : ""}
                            {emAtraso ? " · em atraso" : ""}
                          </p>
                          {varias && onNaoFeito && !t.angariacao_acao_id && (
                            <button type="button" onClick={() => onNaoFeito(t)} className="shrink-0 rounded-full border border-linha px-2 py-0.5 text-[0.6875rem] font-semibold text-secundario hover:bg-black/5">
                              Não feito
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {!varias && onNaoFeito && !tarefas[0].angariacao_acao_id && (
                <button type="button" onClick={() => onNaoFeito(tarefas[0])} className="shrink-0 rounded-full border border-linha px-2.5 py-1 text-xs font-semibold text-secundario hover:bg-black/5">
                  Não feito
                </button>
              )}
              {(() => {
                // Se algum seguimento vem do plano de uma angariação, o link vai para a angariação, onde se marca o follow-up.
                const ang = angariacaoDe.get(chave);
                return (
                  <Link href={(ang ?? ficha).href} className="shrink-0 text-sm font-medium text-azul">
                    {ang ? "Abrir angariação" : "Abrir ficha"}
                  </Link>
                );
              })()}
            </li>
          );
        })}
      </ul>
      {grupos.length > VISIVEIS && (
        <button onClick={() => setTodos((v) => !v)} className="block text-sm text-secundario underline">
          {todos ? "Ver menos" : `Ver todos (${grupos.length})`}
        </button>
      )}
    </>
  );
}
