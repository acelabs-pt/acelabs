"use client";

import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { apagarChamada, haQuanto, registarChamadaAgora, type Contacto } from "@/lib/contactos";
import { formatarDia, formatarHora } from "@/lib/datas";
import { useToast } from "@/components/Toast";

// Histórico de chamadas de um contacto, com registo rápido: um toque regista uma chamada feita agora,
// com uma nota opcional. Cada entrada pode ser apagada (por engano acontece).
export default function ContactosRegistados({ contactoId }: { contactoId: string }) {
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [nota, setNota] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const { avisar } = useToast();

  const carregar = useCallback(async () => {
    const { data, error } = await sbBrowser()
      .from("chamadas")
      .select("id, ocorreu_em, observacoes")
      .eq("contacto_id", contactoId)
      .order("ocorreu_em", { ascending: false });
    if (error) setErro("Não foi possível carregar o histórico.");
    else setLista((data ?? []) as Contacto[]);
  }, [contactoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    const id = await registarChamadaAgora(contactoId, nota.trim() || null);
    setAGuardar(false);
    if (!id) return setErro("Não foi possível registar a chamada.");
    setNota("");
    await carregar();
    avisar("Chamada registada.", {
      rotulo: "Desfazer",
      onAcao: async () => {
        await apagarChamada(id);
        await carregar();
      },
    });
  }

  async function apagar(c: Contacto) {
    if (!window.confirm("Apagar este registo de chamada?")) return;
    await apagarChamada(c.id);
    await carregar();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-linha bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-tinta">Chamadas</h3>
        {lista && lista.length > 0 && <span className="text-xs text-secundario">última {haQuanto(lista[0].ocorreu_em)}</span>}
      </div>
      <form onSubmit={registar} className="space-y-2">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Nota da chamada (opcional)"
          className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-base text-tinta"
        />
        <button type="submit" disabled={aGuardar} className="w-full rounded-full bg-tinta py-3 text-base font-semibold text-white hover:bg-black disabled:opacity-60">
          {aGuardar ? "A registar..." : "Registei uma chamada agora"}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      {lista && lista.length === 0 && <p className="text-sm text-secundario">Ainda não há chamadas registadas.</p>}
      {lista && lista.length > 0 && (
        <button
          type="button"
          onClick={() => setVerHistorico((v) => !v)}
          aria-expanded={verHistorico}
          className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-secundario"
        >
          <span>Chamadas anteriores ({lista.length})</span>
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${verHistorico ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {verHistorico && (
        <ul className="space-y-2">
          {(lista ?? []).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-xl bg-black/[0.035] p-3 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-secundario">
                  {formatarDia(new Date(c.ocorreu_em))} {formatarHora(c.ocorreu_em)}
                </p>
                {c.observacoes && <p className="mt-0.5 text-tinta">{c.observacoes}</p>}
              </div>
              <button onClick={() => apagar(c)} aria-label="Apagar este registo" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-secundario hover:bg-black/5">
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
