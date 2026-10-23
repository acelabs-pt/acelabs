"use client";

import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDoDia, somarDias } from "@/lib/datas";

// Tarefas em atraso e de hoje. Marcar aqui é o mesmo que marcar no Calendário.
export default function Hoje({ tarefas, total, onAlternar, onAdiar }: { tarefas: Tarefa[]; total: number; onAlternar: (t: Tarefa) => void; onAdiar: (t: Tarefa) => void }) {
  const hoje = inicioDoDia(new Date());
  const amanha = somarDias(hoje, 1);
  const lista = tarefas
    .filter((t) => !t.feita && t.inicio && new Date(t.inicio) < amanha)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!));
  const mostradas = lista.slice(0, 6);
  const proxima = tarefas
    .filter((t) => !t.feita && t.tipo === "evento" && t.inicio && new Date(t.inicio) >= new Date())
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))[0];

  return (
    <Cartao
      titulo="Hoje"
      acao={
        <Link href="/calendario" className="text-sm font-medium text-azul">
          Calendário
        </Link>
      }
    >
      {proxima && (
        <p className="rounded-lg bg-azul/10 px-3 py-2 text-sm text-azul-escuro">
          A seguir: <b>{proxima.titulo}</b> · {formatarDia(new Date(proxima.inicio!))} {formatarHora(proxima.inicio!)}
        </p>
      )}
      {mostradas.length === 0 ? (
        <p className="text-sm text-secundario">Nada em atraso nem para hoje.</p>
      ) : (
        <ul className="space-y-1.5">
          {mostradas.map((t) => {
            const atrasada = new Date(t.inicio!) < hoje;
            return (
              <li key={t.id}>
                <SwipeLinha
                  className="rounded-xl"
                  direita={{ rotulo: "Feita", classe: "bg-verde text-white", onAcao: () => onAlternar(t) }}
                  esquerda={{ rotulo: "Adiar", classe: "bg-azul text-white", onAcao: () => onAdiar(t) }}
                >
                  <div className="flex items-center gap-3 bg-white py-1.5">
                    <button
                      onClick={() => onAlternar(t)}
                      aria-label="Marcar como feita"
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-black/20"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-tinta">{t.titulo}</p>
                      <p className={`text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                        {atrasada ? `${formatarDia(new Date(t.inicio!))} · em atraso` : formatarHora(t.inicio!) || "Hoje"}
                      </p>
                    </div>
                    <button onClick={() => onAdiar(t)} className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-secundario">
                      Adiar
                    </button>
                  </div>
                </SwipeLinha>
              </li>
            );
          })}
        </ul>
      )}
      {total > mostradas.length && (
        <Link href="/calendario" className="block text-sm text-secundario underline">
          + {total - mostradas.length} mais
        </Link>
      )}
    </Cartao>
  );
}
