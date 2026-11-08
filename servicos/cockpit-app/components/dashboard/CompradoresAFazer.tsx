"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dados } from "@/lib/painel";
import { alertaLaranja, contar, proximoPasso, type Comprador } from "@/lib/comprador";

const VISIVEIS = 8;

export type ProximoPassoComprador = { c: Comprador; passo: string; alerta: string | null };

/**
 * O que há para fazer com cada comprador, pela fase em que está (enviar opções, propor visita, agendar escritura...), dos mais
 * motivados para os menos motivados. Vem do estado de cada comprador, por isso aparece mesmo que a tarefa semanal ainda não exista.
 * Ficam de fora os que já acabaram (perdidos, negócio concluído) e os que só estão à espera.
 */
export function compradoresAFazer(dados: Dados): ProximoPassoComprador[] {
  const imoveisPor = new Map<string, Dados["imoveis"]>();
  for (const i of dados.imoveis) imoveisPor.set(i.comprador_id, [...(imoveisPor.get(i.comprador_id) ?? []), i]);
  return dados.compradores
    .filter((c) => c.estado !== "perdido" && c.estado !== "negocio_concluido")
    .map((c) => ({ c, passo: proximoPasso(c, contar(imoveisPor.get(c.id) ?? [])), alerta: alertaLaranja(c) }))
    .filter((x): x is ProximoPassoComprador => !!x.passo && !x.passo.startsWith("Aguardar"))
    .sort((a, b) => (b.c.motivacao ?? -1) - (a.c.motivacao ?? -1) || a.c.estado_desde.localeCompare(b.c.estado_desde));
}

export default function CompradoresAFazerLista({ itens }: { itens: ProximoPassoComprador[] }) {
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? itens : itens.slice(0, VISIVEIS);
  if (itens.length === 0) return <p className="py-2 text-sm text-secundario">Nenhum comprador com passos por fazer.</p>;
  return (
    <>
      <ul className="divide-y divide-linha">
        {mostrados.map(({ c, passo, alerta }) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-azul">Comprador</p>
              <div className="flex items-center gap-2">
                <span className="min-w-0 truncate text-[15px] font-bold text-tinta">{c.contactos.nome}</span>
                <span className="shrink-0 rounded-full bg-azul-suave px-2.5 py-0.5 text-xs font-semibold text-azul-escuro">{passo}</span>
              </div>
              <p className="truncate text-xs text-secundario">
                {c.motivacao != null ? `Motivação ${c.motivacao}/10` : "Motivação por definir"}
                {alerta ? <span className="font-medium text-ambar-texto"> · {alerta}</span> : null}
              </p>
            </div>
            <Link href={`/crm/compradores/${c.id}`} className="shrink-0 text-sm font-semibold text-azul">
              Abrir ficha
            </Link>
          </li>
        ))}
      </ul>
      {itens.length > VISIVEIS && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-1 block text-sm text-secundario underline">
          {todos ? "Ver menos" : `Ver todos (${itens.length})`}
        </button>
      )}
    </>
  );
}
