"use client";

import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDoDia, somarDias } from "@/lib/datas";

function fichaDaTarefa(t: Tarefa): string | null {
  if (t.comprador_id) return `/crm/compradores/${t.comprador_id}`;
  if (t.proprietario_id) return `/crm/proprietarios/${t.proprietario_id}`;
  return null;
}

// Tarefas em atraso e de hoje. Marcar aqui é o mesmo que marcar no Calendário.
export default function Hoje({
  tarefas,
  total,
  onAlternar,
  onAdiar,
  telefone,
}: {
  tarefas: Tarefa[];
  total: number;
  onAlternar: (t: Tarefa) => void;
  onAdiar: (t: Tarefa) => void;
  /** Telemóvel do contacto da tarefa, se houver (para ligar sem abrir a ficha). */
  telefone?: (t: Tarefa) => string | null;
}) {
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
                  direita={{ rotulo: "Feita", classe: "bg-verde text-tinta", onAcao: () => onAlternar(t) }}
                  esquerda={{ rotulo: "Adiar", classe: "bg-azul text-white", onAcao: () => onAdiar(t) }}
                >
                  <div className="flex items-center gap-3 bg-white py-1.5">
                    <button
                      onClick={() => onAlternar(t)}
                      aria-label="Marcar como feita"
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-black/20"
                    />
                    <div className="min-w-0 flex-1">
                      {fichaDaTarefa(t) ? (
                        // tocar no título abre a ficha da pessoa
                        <Link href={fichaDaTarefa(t)!} className="block truncate text-sm text-tinta hover:text-azul-escuro">
                          {t.titulo}
                        </Link>
                      ) : (
                        <p className="truncate text-sm text-tinta">{t.titulo}</p>
                      )}
                      <p className={`text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                        {atrasada ? `${formatarDia(new Date(t.inicio!))} · em atraso` : formatarHora(t.inicio!) || "Hoje"}
                      </p>
                    </div>
                    {telefone?.(t) && (
                      <a
                        href={`tel:${telefone(t)}`}
                        aria-label="Ligar"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul-suave text-azul-escuro hover:bg-azul hover:text-white"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
                        </svg>
                      </a>
                    )}
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
