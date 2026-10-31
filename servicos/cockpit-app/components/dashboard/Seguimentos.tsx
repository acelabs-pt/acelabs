"use client";

import { useState } from "react";
import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import type { Dados } from "@/lib/painel";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDaSemana, somarDias } from "@/lib/datas";

const VISIVEIS = 8;

type Ficha = { href: string; tipo: "comprador" | "proprietario" };

const ETIQUETA = {
  comprador: { texto: "Comprador", classe: "bg-azul/10 text-azul" },
  proprietario: { texto: "Proprietário", classe: "bg-verde/15 text-verde" },
} as const;

// Ficha do cliente a que o seguimento diz respeito (comprador ou proprietário). Sem ficha, não é um seguimento.
function fichaDe(t: Tarefa, d: Dados): Ficha | null {
  if (t.comprador_id) return { href: `/crm/compradores/${t.comprador_id}`, tipo: "comprador" };
  if (t.proprietario_id) return { href: `/crm/proprietarios/${t.proprietario_id}`, tipo: "proprietario" };
  if (t.angariacao_acao_id) {
    const acao = d.acoes.find((a) => a.id === t.angariacao_acao_id);
    if (!acao?.follow_up) return null; // só os follow ups ao proprietário, não as outras ações do plano
    const ang = d.angariacoes.find((a) => a.id === acao.angariacao_id);
    return ang?.proprietario_id ? { href: `/crm/proprietarios/${ang.proprietario_id}`, tipo: "proprietario" } : null;
  }
  return null;
}

// Seguimentos a clientes desta semana (e os que ficaram para trás), cada um com a ficha do cliente à frente.
// Sem checkbox: o seguimento dá-se como feito na própria ficha (ou no Calendário).
export default function Seguimentos({ dados }: { dados: Dados }) {
  const [todos, setTodos] = useState(false);
  const inicioSemana = inicioDaSemana(new Date());
  const fimSemana = somarDias(inicioSemana, 7);

  const lista = dados.tarefas
    .filter((t) => t.tipo === "tarefa" && !t.feita && t.inicio && new Date(t.inicio) < fimSemana)
    .map((t) => ({ t, ficha: fichaDe(t, dados) }))
    .filter((x): x is { t: Tarefa; ficha: Ficha } => x.ficha !== null)
    .sort((a, b) => a.t.inicio!.localeCompare(b.t.inicio!));
  const mostradas = todos ? lista : lista.slice(0, VISIVEIS);

  return (
    <Cartao titulo={`Seguimentos da semana${lista.length ? ` (${lista.length})` : ""}`}>
      {lista.length === 0 ? (
        <p className="text-sm text-secundario">Sem seguimentos para esta semana.</p>
      ) : (
        <ul className="space-y-2">
          {mostradas.map(({ t, ficha }) => {
            const atrasada = new Date(t.inicio!) < inicioSemana;
            return (
              <li key={t.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-tinta">{t.titulo}</p>
                  <p className={`flex flex-wrap items-center gap-x-1.5 text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ETIQUETA[ficha.tipo].classe}`}>
                      {ETIQUETA[ficha.tipo].texto}
                    </span>
                    {formatarDia(new Date(t.inicio!))}
                    {formatarHora(t.inicio!) ? ` · ${formatarHora(t.inicio!)}` : ""}
                    {atrasada ? " · em atraso" : ""}
                  </p>
                </div>
                <Link href={ficha.href} className="shrink-0 rounded-lg bg-azul px-3 py-1.5 text-xs font-semibold text-white">
                  Abrir ficha
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {lista.length > VISIVEIS && (
        <button onClick={() => setTodos((v) => !v)} className="block text-sm text-secundario underline">
          {todos ? "Ver menos" : `+ ${lista.length - VISIVEIS} mais`}
        </button>
      )}
    </Cartao>
  );
}
