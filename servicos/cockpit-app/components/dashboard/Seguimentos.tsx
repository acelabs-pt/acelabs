"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dados } from "@/lib/painel";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDaSemana, inicioDoDia, somarDias } from "@/lib/datas";

const VISIVEIS = 6;

type Ficha = { href: string; tipo: "comprador" | "proprietario"; id: string };

// Ficha do cliente a que o seguimento diz respeito (comprador ou proprietário). Sem ficha, não é um seguimento.
function fichaDe(t: Tarefa, d: Dados): Ficha | null {
  if (t.comprador_id) return { href: `/crm/compradores/${t.comprador_id}`, tipo: "comprador", id: t.comprador_id };
  if (t.proprietario_id) return { href: `/crm/proprietarios/${t.proprietario_id}`, tipo: "proprietario", id: t.proprietario_id };
  if (t.angariacao_acao_id) {
    const acao = d.acoes.find((a) => a.id === t.angariacao_acao_id);
    if (!acao?.follow_up) return null; // só os follow ups ao proprietário, não as outras ações do plano
    const ang = d.angariacoes.find((a) => a.id === acao.angariacao_id);
    return ang?.proprietario_id ? { href: `/crm/proprietarios/${ang.proprietario_id}`, tipo: "proprietario", id: ang.proprietario_id } : null;
  }
  return null;
}

// O que há para fazer, em duas palavras (o título completo fica atrás da seta).
function acaoDe(t: Tarefa): string {
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
export const temCliente = (t: Tarefa, d: Dados) => fichaDe(t, d) !== null;

export type Seguimento = { t: Tarefa; ficha: Ficha };

/**
 * Seguimentos a clientes por fazer, em dois grupos: os que ficaram para trás (antes de hoje) e os do período (hoje, ou de hoje
 * até ao fim da semana). Só entram as tarefas ligadas a uma ficha de cliente (comprador, proprietário ou follow-up de uma angariação).
 * filtro: tipo de cliente; "angariacao" = tarefas que vêm do plano de uma angariação.
 */
export function seguimentosDe(
  dados: Dados,
  periodo: "hoje" | "semana",
  filtro: "todos" | "comprador" | "proprietario" | "angariacao"
): { atrasados: Seguimento[]; doPeriodo: Seguimento[] } {
  const inicioHoje = inicioDoDia(new Date());
  const fim = periodo === "hoje" ? somarDias(inicioHoje, 1) : somarDias(inicioDaSemana(inicioHoje), 7);
  const motivacoes = new Map(dados.compradores.map((c) => [c.id, c.motivacao]));
  const todos = dados.tarefas
    .filter((t) => t.tipo === "tarefa" && !t.feita && t.inicio && new Date(t.inicio) < fim)
    .filter((t) => filtro === "todos" || t.origem === filtro)
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
  const mostradas = todos ? itens : itens.slice(0, VISIVEIS);

  if (itens.length === 0) return <p className="py-2 text-sm text-secundario">{vazio}</p>;
  return (
    <>
      <ul className="divide-y divide-linha">
        {mostradas.map(({ t, ficha }) => {
          const atrasada = new Date(t.inicio!) < inicioHoje;
          const cliente = clienteDe(ficha, dados);
          return (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() =>
                    setAbertos((a) => {
                      const n = new Set(a);
                      if (!n.delete(t.id)) n.add(t.id);
                      return n;
                    })
                  }
                  aria-expanded={abertos.has(t.id)}
                  aria-label="Ver detalhes do seguimento"
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="min-w-0 truncate text-[15px] font-bold text-tinta">{cliente.nome ?? t.titulo}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${atrasada ? "bg-ambar-fundo text-ambar-texto" : "bg-azul-suave text-azul-escuro"}`}>{acaoDe(t)}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 shrink-0 text-secundario transition-transform ${abertos.has(t.id) ? "rotate-180" : ""}`}
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
                {abertos.has(t.id) && (
                  <p className={`mt-0.5 text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                    {t.titulo} · {formatarDia(new Date(t.inicio!))}
                    {formatarHora(t.inicio!) ? ` · ${formatarHora(t.inicio!)}` : ""}
                    {atrasada ? " · em atraso" : ""}
                  </p>
                )}
              </div>
              {onNaoFeito && !t.angariacao_acao_id && (
                <button type="button" onClick={() => onNaoFeito(t)} className="shrink-0 rounded-full border border-linha px-2.5 py-1 text-xs font-semibold text-secundario hover:bg-black/5">
                  Não feito
                </button>
              )}
              <Link href={ficha.href} className="shrink-0 text-sm font-medium text-azul">
                Abrir ficha
              </Link>
            </li>
          );
        })}
      </ul>
      {itens.length > VISIVEIS && (
        <button onClick={() => setTodos((v) => !v)} className="block text-sm text-secundario underline">
          {todos ? "Ver menos" : `Ver todos (${itens.length})`}
        </button>
      )}
    </>
  );
}
