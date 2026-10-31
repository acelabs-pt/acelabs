"use client";

import { useState } from "react";
import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import type { Dados } from "@/lib/painel";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDaSemana, somarDias } from "@/lib/datas";

const VISIVEIS = 8;

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
  if (x.includes("reunião")) return "Reunião";
  if (x.includes("visita")) return "Visita";
  if (x.includes("escritura")) return "Escritura";
  if (x.includes("ligar") || x.includes("seguimento") || x.includes("contactar") || x.includes("contacto")) return "Ligar";
  if (x.includes("pedir")) return "Pedir";
  return "Tarefa";
}

// Nome do cliente e, nos proprietários, o imóvel que têm (só tipologia, freguesia e concelho).
function clienteDe(f: Ficha, d: Dados): { nome: string | null; imovel: string } {
  if (f.tipo === "comprador") return { nome: d.compradores.find((c) => c.id === f.id)?.contactos.nome ?? null, imovel: "" };
  const p = d.proprietarios.find((x) => x.id === f.id);
  return { nome: p?.contactos.nome ?? null, imovel: p ? [p.tipologia, p.freguesia, p.concelho].filter(Boolean).join(" · ") : "" };
}

// Seguimentos a clientes desta semana (e os que ficaram para trás), cada um com a ficha do cliente à frente.
// Sem checkbox: o seguimento dá-se como feito na própria ficha (ou no Calendário).
export default function Seguimentos({ dados }: { dados: Dados }) {
  const [todos, setTodos] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Ficha["tipo"] | null>(null);
  const inicioSemana = inicioDaSemana(new Date());
  const fimSemana = somarDias(inicioSemana, 7);

  const lista = dados.tarefas
    .filter((t) => t.tipo === "tarefa" && !t.feita && t.inicio && new Date(t.inicio) < fimSemana)
    .map((t) => ({ t, ficha: fichaDe(t, dados) }))
    .filter((x): x is { t: Tarefa; ficha: Ficha } => x.ficha !== null)
    .sort((a, b) => a.t.inicio!.localeCompare(b.t.inicio!));
  const contagem = { comprador: 0, proprietario: 0 };
  for (const x of lista) contagem[x.ficha.tipo]++;
  const filtrada = filtro ? lista.filter((x) => x.ficha.tipo === filtro) : lista;
  const mostradas = todos ? filtrada : filtrada.slice(0, VISIVEIS);

  return (
    <Cartao titulo={`Seguimentos da semana${lista.length ? ` (${lista.length})` : ""}`}>
      {lista.length > 0 && (
        <div className="flex gap-2">
          {(["comprador", "proprietario"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setFiltro((f) => (f === tipo ? null : tipo));
                setTodos(false);
              }}
              aria-pressed={filtro === tipo}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                filtro === tipo ? "bg-azul text-white" : "bg-azul/10 text-azul-escuro"
              }`}
            >
              {tipo === "comprador" ? "Compradores" : "Proprietários"} ({contagem[tipo]})
            </button>
          ))}
        </div>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-secundario">Sem seguimentos para esta semana.</p>
      ) : filtrada.length === 0 ? (
        <p className="text-sm text-secundario">Sem seguimentos {filtro === "comprador" ? "a compradores" : "a proprietários"} esta semana.</p>
      ) : (
        <ul className="space-y-2">
          {mostradas.map(({ t, ficha }) => {
            const atrasada = new Date(t.inicio!) < inicioSemana;
            const cliente = clienteDe(ficha, dados);
            return (
              <li key={t.id} className="flex items-center gap-3">
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
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-tinta">{cliente.nome ?? t.titulo}</span>
                    <span className="shrink-0 rounded-full bg-azul/10 px-2 py-0.5 text-[11px] font-medium text-azul-escuro">{acaoDe(t)}</span>
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
                    <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                      {formatarDia(new Date(t.inicio!))}
                      {formatarHora(t.inicio!) ? ` · ${formatarHora(t.inicio!)}` : ""}
                      {atrasada ? " · em atraso" : ""}
                    </p>
                  )}
                </div>
                <Link href={ficha.href} className="shrink-0 rounded-lg bg-azul px-3 py-1.5 text-xs font-semibold text-white">
                  Abrir ficha
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {filtrada.length > VISIVEIS && (
        <button onClick={() => setTodos((v) => !v)} className="block text-sm text-secundario underline">
          {todos ? "Ver menos" : `+ ${filtrada.length - VISIVEIS} mais`}
        </button>
      )}
    </Cartao>
  );
}
