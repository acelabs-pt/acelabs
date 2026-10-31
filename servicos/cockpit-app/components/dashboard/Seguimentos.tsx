"use client";

import { useState } from "react";
import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import type { Dados, TarefaSeguimento } from "@/lib/painel";
import { formatarDia, formatarHora, inicioDaSemana, somarDias } from "@/lib/datas";

const VISIVEIS = 8;

type Ficha = { href: string; tipo: "comprador" | "proprietario" };

const ETIQUETA = {
  comprador: { texto: "Comprador", classe: "bg-azul-suave text-azul-escuro" },
  proprietario: { texto: "Proprietário", classe: "bg-verde-suave text-tinta" },
} as const;

// Ficha do cliente a que o seguimento diz respeito (comprador ou proprietário). Sem ficha, não é um seguimento.
function fichaDe(t: TarefaSeguimento): Ficha | null {
  if (t.comprador_id) return { href: `/crm/compradores/${t.comprador_id}`, tipo: "comprador" };
  if (t.proprietario_id) return { href: `/crm/proprietarios/${t.proprietario_id}`, tipo: "proprietario" };
  if (t.angariacao_acao_id) {
    // só os follow ups ao proprietário, não as outras ações do plano
    if (!t.angariacao_acoes?.follow_up) return null;
    const prop = t.angariacao_acoes.angariacoes?.proprietario_id;
    return prop ? { href: `/crm/proprietarios/${prop}`, tipo: "proprietario" } : null;
  }
  return null;
}

// Seguimentos a clientes desta semana (e os que ficaram para trás), cada um com a ficha do cliente à frente.
// Sem checkbox: o seguimento dá-se como feito na própria ficha (ou no Calendário).
export default function Seguimentos({ dados }: { dados: Dados }) {
  const [todos, setTodos] = useState(false);
  const inicioSemana = inicioDaSemana(new Date());
  const fimSemana = somarDias(inicioSemana, 7);

  const lista = dados.seguimentos
    .filter((t) => t.tipo === "tarefa" && !t.feita && t.inicio && new Date(t.inicio) < fimSemana)
    .map((t) => ({ t, ficha: fichaDe(t) }))
    .filter((x): x is { t: TarefaSeguimento; ficha: Ficha } => x.ficha !== null)
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
