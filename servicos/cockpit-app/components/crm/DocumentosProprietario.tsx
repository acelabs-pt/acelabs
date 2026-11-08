"use client";

import { useCallback, useEffect, useState } from "react";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { sbBrowser } from "@/lib/supabase-browser";
import { DOCUMENTOS_PROPRIETARIO } from "@/lib/proprietario";

type Documento = { id: string; nome: string; entregue: boolean };

// Documentos que o proprietário tem de entregar para a angariação e a escritura: lista fixa por defeito, a que se
// podem juntar outros à mão. Marca-se "entregue" com o toque ou a deslizar, como nos documentos do comprador.
export default function DocumentosProprietario({ proprietarioId }: { proprietarioId: string }) {
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await sbBrowser().from("proprietario_documentos").select("*").eq("proprietario_id", proprietarioId).order("created_at");
    if (error) setErro("Não foi possível carregar os documentos.");
    else setDocs((data ?? []) as Documento[]);
  }, [proprietarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    const { error } = await sbBrowser().from("proprietario_documentos").insert({ proprietario_id: proprietarioId, nome });
    if (error) return setErro("Não foi possível juntar o documento.");
    setNovo("");
    await carregar();
  }

  async function usarListaPadrao() {
    const existentes = new Set((docs ?? []).map((d) => d.nome.trim().toLowerCase()));
    const novos = DOCUMENTOS_PROPRIETARIO.filter((n) => !existentes.has(n.toLowerCase()));
    if (novos.length === 0) return;
    const { error } = await sbBrowser().from("proprietario_documentos").insert(novos.map((nome) => ({ proprietario_id: proprietarioId, nome })));
    if (error) return setErro("Não foi possível juntar a lista de documentos.");
    await carregar();
  }

  async function alternar(d: Documento) {
    setDocs((ds) => (ds ?? []).map((x) => (x.id === d.id ? { ...x, entregue: !x.entregue } : x)));
    await sbBrowser().from("proprietario_documentos").update({ entregue: !d.entregue }).eq("id", d.id);
  }

  async function apagar(d: Documento) {
    if (!window.confirm(`Remover "${d.nome}" da lista?`)) return;
    await sbBrowser().from("proprietario_documentos").delete().eq("id", d.id);
    await carregar();
  }

  const lista = docs ?? [];
  const faltaDaLista = DOCUMENTOS_PROPRIETARIO.some((n) => !lista.some((d) => d.nome.trim().toLowerCase() === n.toLowerCase()));

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      <h3 className="text-sm font-semibold text-tinta">Documentos em falta ({lista.filter((d) => !d.entregue).length})</h3>
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      <ul className="space-y-1.5">
        {lista.map((d) => (
          <li key={d.id}>
            <SwipeLinha
              className="rounded-lg"
              direita={{ rotulo: d.entregue ? "Por entregar" : "Entregue", classe: d.entregue ? "bg-secundario text-tinta" : "bg-verde text-tinta", onAcao: () => alternar(d) }}
              esquerda={{ rotulo: "Remover", classe: "bg-red-600 text-white", onAcao: () => apagar(d) }}
            >
              <label className="flex items-center gap-2 bg-white py-1 text-sm">
                <input type="checkbox" checked={d.entregue} onChange={() => alternar(d)} />
                <span className={d.entregue ? "text-secundario line-through" : "text-tinta"}>{d.nome}</span>
              </label>
            </SwipeLinha>
          </li>
        ))}
      </ul>
      {docs && faltaDaLista && (
        <button type="button" onClick={usarListaPadrao} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
          {lista.length === 0 ? "Usar a lista habitual" : "Juntar os que faltam da lista habitual"}
        </button>
      )}
      <form onSubmit={adicionar} className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Adicionar documento"
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        />
        <button type="submit" disabled={!novo.trim()} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
          Juntar
        </button>
      </form>
    </section>
  );
}
