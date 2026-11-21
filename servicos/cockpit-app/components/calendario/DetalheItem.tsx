"use client";

import { useArrastarParaFechar } from "@/components/gestos/useGestos";
import Link from "next/link";
import { useState } from "react";
import { formatarDia, formatarHora, isoParaLocal } from "@/lib/datas";
import type { Tarefa } from "@/lib/types";

const ORIGEM: Record<Tarefa["origem"], string> = {
  manual: "",
  meta: "Meta",
  comprador: "Comprador",
  proprietario: "Proprietário",
  angariacao: "Angariação",
};

function ligacao(t: Tarefa): { href: string; texto: string } | null {
  if (t.comprador_id) return { href: `/crm/compradores/${t.comprador_id}`, texto: "Abrir ficha do comprador" };
  if (t.proprietario_id) return { href: `/crm/proprietarios/${t.proprietario_id}`, texto: "Abrir ficha do proprietário" };
  if (t.angariacao_acao_id) return { href: "/angariacoes", texto: "Ver angariações" };
  return null;
}

export default function DetalheItem({
  t,
  onFechar,
  onAlternar,
  onApagar,
  onMudar,
}: {
  t: Tarefa;
  onFechar: () => void;
  onAlternar: () => void;
  onApagar: () => void;
  /** Mudar o dia e a hora (no telemóvel não se arrasta na grelha). */
  onMudar?: (quando: Date) => void;
}) {
  const arrasto = useArrastarParaFechar(onFechar);
  const [mudar, setMudar] = useState(false);
  const [valor, setValor] = useState(() => (t.inicio ? isoParaLocal(t.inicio) : ""));
  const l = ligacao(t);
  const ini = t.inicio ? new Date(t.inicio) : null;
  const hora = t.inicio ? formatarHora(t.inicio) : "";
  const fim = t.fim ? formatarHora(t.fim) : "";
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar}>
      <div
        {...arrasto.painel}
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div {...arrasto.pega} className="-mt-2 flex justify-center py-2 md:hidden" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-secundario">
              {t.tipo === "evento" ? "Marcação" : "Tarefa"}
              {ORIGEM[t.origem] ? ` · ${ORIGEM[t.origem]}` : ""}
            </p>
            <h3 className="text-lg font-semibold text-tinta">{t.titulo}</h3>
            <p className="text-sm text-secundario">
              {ini ? formatarDia(ini) : "Sem data"}
              {hora ? `, ${hora}${fim ? ` - ${fim}` : ""}` : ini ? ", dia inteiro" : ""}
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="p-1 text-2xl leading-none text-secundario">
            &times;
          </button>
        </div>
        <button
          onClick={onAlternar}
          className={`w-full rounded-xl py-3 text-base font-semibold ${t.feita ? "bg-black/5 text-tinta" : "bg-verde text-tinta"}`}
        >
          {t.feita ? "Desmarcar (voltar a por fazer)" : "Marcar como feita"}
        </button>
        {l && (
          <Link href={l.href} className="block rounded-xl bg-azul/10 py-2.5 text-center text-sm font-semibold text-azul-escuro">
            {l.texto}
          </Link>
        )}
        {onMudar && !t.feita && (
          mudar ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (valor) onMudar(new Date(valor));
              }}
            >
              <label htmlFor="mudar-quando" className="sr-only">Dia e hora</label>
              <input
                id="mudar-quando"
                type="datetime-local"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-linha px-3 py-2 text-base text-tinta"
              />
              <button type="submit" className="rounded-xl bg-azul px-4 py-2.5 text-sm font-semibold text-white">Guardar</button>
            </form>
          ) : (
            <button onClick={() => setMudar(true)} className="block w-full rounded-xl border border-linha py-2.5 text-center text-sm font-semibold text-tinta">
              Mudar dia e hora
            </button>
          )
        )}
        {ini && !t.feita && (
          // ficheiro de calendário: o telemóvel avisa com notificação própria (30 min antes nas marcações)
          <a
            href={`/api/tarefas/${t.id}/calendario`}
            className="block rounded-xl border border-linha py-2.5 text-center text-sm font-semibold text-tinta"
          >
            Pôr no calendário do telemóvel
          </a>
        )}
        <button onClick={onApagar} className="w-full py-1 text-sm text-red-600">
          Apagar
        </button>
      </div>
    </div>
  );
}
