"use client";

import { useState } from "react";
import Link from "next/link";
import { decidirMatch, etiquetaImovel, type Decisao, type Match } from "@/lib/match";
import { resumoLocais } from "@/lib/localizacoes";

const eur = (n: number) => `${n.toLocaleString("pt-PT")} EUR`;

// Compatibilidades entre um comprador e imóveis (ou de um imóvel com compradores).
// "vista" diz qual é a ficha onde estamos: na do comprador mostramos imóveis, na do imóvel mostramos compradores.
export default function ListaMatches({
  matches,
  vista,
  onAlterado,
}: {
  matches: Match[];
  vista: "comprador" | "imovel";
  onAlterado: () => void;
}) {
  const [aGuardar, setAGuardar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (matches.length === 0) return null;

  const porVerificar = matches.filter((m) => !m.confirmado).length;

  async function decidir(m: Match, estado: Decisao | null) {
    const chave = `${m.comprador.id}:${m.proprietario.id}`;
    setAGuardar(chave);
    setErro(null);
    const e = await decidirMatch(m.comprador.id, m.proprietario.id, estado);
    if (e) setErro(e);
    await onAlterado();
    setAGuardar(null);
  }

  return (
    <section className="space-y-3 rounded-2xl bg-ambar-fundo p-4">
      <h3 className="text-sm font-semibold text-ambar-texto">
        {vista === "comprador" ? "Imóveis compatíveis" : "Compradores compatíveis"}
        {porVerificar > 0 && ` (${porVerificar} por verificar)`}
      </h3>
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <ul className="space-y-2">
        {matches.map((m) => {
          const chave = `${m.comprador.id}:${m.proprietario.id}`;
          const c = m.comprador;
          const href =
            vista === "comprador"
              ? m.angariacao
                ? `/angariacoes/${m.angariacao.id}`
                : `/crm/proprietarios/${m.proprietario.id}`
              : `/crm/compradores/${c.id}`;
          const titulo = vista === "comprador" ? etiquetaImovel(m) : c.contactos.nome;
          const detalhe =
            vista === "comprador"
              ? [m.angariacao ? "Angariação" : "Proprietário ainda por angariar", m.proprietario.valor != null ? eur(m.proprietario.valor) : null]
              : [
                  [c.tipo_imovel, c.tipologia_minima].filter(Boolean).join(" "),
                  resumoLocais(c.localizacoes),
                  c.expectativa_valor != null ? `até ${eur(c.expectativa_valor)}` : null,
                  c.motivacao != null ? `motivação ${c.motivacao}/10` : null,
                ];
          return (
            <li key={chave} className="space-y-2 rounded-xl bg-white p-3">
              <Link href={href} className="block">
                <p className="truncate text-sm font-semibold text-tinta">{titulo}</p>
                <p className="truncate text-xs text-secundario">{detalhe.filter(Boolean).join(" · ")}</p>
              </Link>
              {m.confirmado ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-verde">Faz sentido</span>
                  <button disabled={aGuardar === chave} onClick={() => decidir(m, null)} className="text-secundario underline">
                    Desfazer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    disabled={aGuardar === chave}
                    onClick={() => decidir(m, "faz_sentido")}
                    className="flex-1 rounded-lg bg-verde py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Faz sentido
                  </button>
                  <button
                    disabled={aGuardar === chave}
                    onClick={() => decidir(m, "nao_faz_sentido")}
                    className="flex-1 rounded-lg bg-black/5 py-2 text-xs font-semibold text-tinta disabled:opacity-50"
                  >
                    Não faz sentido
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
