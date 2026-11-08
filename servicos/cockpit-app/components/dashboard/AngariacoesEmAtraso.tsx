"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dados } from "@/lib/painel";
import { inicioDoDia } from "@/lib/datas";

const VISIVEIS = 8;

// As minhas angariações, uma linha por angariação, com um alerta do número de acções do plano em atraso (as mesmas tarefas que o
// Calendário mostra). Ao tocar, abre a angariação. As que têm mais atraso vêm primeiro. Só aparece na categoria "Angariações".
export default function AngariacoesEmAtraso({ dados }: { dados: Dados }) {
  const [todas, setTodas] = useState(false);
  const hoje = inicioDoDia(new Date());
  const acaoParaAng = new Map(dados.acoes.map((a) => [a.id, a.angariacao_id]));
  const emAtraso = new Map<string, number>();
  for (const t of dados.tarefas) {
    if (t.feita || !t.inicio || !t.angariacao_acao_id || new Date(t.inicio) >= hoje) continue;
    const angId = acaoParaAng.get(t.angariacao_acao_id);
    if (angId) emAtraso.set(angId, (emAtraso.get(angId) ?? 0) + 1);
  }
  const linhas = dados.angariacoes
    .filter((a) => !a.vendido_em)
    .map((a) => ({ a, n: emAtraso.get(a.id) ?? 0 }))
    .sort((x, y) => y.n - x.n);
  const comAtraso = linhas.filter((l) => l.n > 0).length;
  const mostradas = todas ? linhas : linhas.slice(0, VISIVEIS);

  return (
    <div className="rounded-[14px] border border-linha p-3 sm:p-4">
      <h3 className="mb-1 text-sm font-semibold text-secundario">
        As minhas angariações{linhas.length ? ` (${linhas.length})` : ""}
        {comAtraso > 0 && <span className="ml-2 font-medium text-ambar-texto">{comAtraso} com acções em atraso</span>}
      </h3>
      {linhas.length === 0 ? (
        <p className="py-2 text-sm text-secundario">Ainda não há angariações activas.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {mostradas.map(({ a, n }) => (
            <li key={a.id}>
              <Link href={`/angariacoes/${a.id}`} className="flex items-center gap-3 py-2.5">
                <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${n > 0 ? "bg-ambar" : "bg-verde"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-tinta">{a.titulo}</span>
                <span className={`shrink-0 text-xs font-medium ${n > 0 ? "text-ambar-texto" : "text-secundario"}`}>
                  {n > 0 ? `${n} ${n === 1 ? "acção em atraso" : "acções em atraso"}` : "Em dia"}
                </span>
                <span className="shrink-0 text-sm font-medium text-azul">Abrir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {linhas.length > VISIVEIS && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-1 block text-sm text-secundario underline">
          {todas ? "Ver menos" : `Ver todas (${linhas.length})`}
        </button>
      )}
    </div>
  );
}
