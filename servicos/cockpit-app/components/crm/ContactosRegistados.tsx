"use client";

import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { apagarChamada, editarChamada, haQuanto, registarChamada, type Contacto } from "@/lib/contactos";
import { formatarDia, formatarHora } from "@/lib/datas";
import { useToast } from "@/components/Toast";

// Histórico de chamadas de um contacto. Só há um botão "Adicionar chamada"; ao tocar abre o dia e hora (agora por defeito) e a nota.
// Cada entrada pode ser editada ou apagada (por engano acontece).
export default function ContactosRegistados({ contactoId }: { contactoId: string }) {
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [nota, setNota] = useState("");
  // O formulário só abre ao tocar em "Adicionar chamada": data e hora (por defeito agora) e nota.
  const [aAdicionar, setAAdicionar] = useState(false);
  const [quando, setQuando] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const { avisar } = useToast();
  // Chamada em edição: data e hora (formato do campo datetime-local) e nota.
  const [edicao, setEdicao] = useState<{ id: string; quando: string; nota: string } | null>(null);

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
    const data = new Date(quando);
    if (Number.isNaN(data.getTime())) {
      setAGuardar(false);
      return setErro("Data ou hora inválida.");
    }
    const id = await registarChamada(contactoId, data, nota.trim() || null);
    setAGuardar(false);
    if (!id) return setErro("Não foi possível registar a chamada.");
    setNota("");
    setAAdicionar(false);
    await carregar();
    avisar("Chamada registada.", {
      rotulo: "Desfazer",
      onAcao: async () => {
        await apagarChamada(id);
        await carregar();
      },
    });
  }

  const paraCampo = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  function abrirAdicionar() {
    setQuando(paraCampo(new Date().toISOString()));
    setNota("");
    setErro(null);
    setAAdicionar(true);
  }

  async function guardarEdicao() {
    if (!edicao) return;
    const quando = new Date(edicao.quando);
    if (Number.isNaN(quando.getTime())) return setErro("Data ou hora inválida.");
    setErro(null);
    const ok = await editarChamada(edicao.id, quando, edicao.nota.trim() || null);
    if (!ok) return setErro("Não foi possível guardar a alteração.");
    setEdicao(null);
    await carregar();
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
      {aAdicionar ? (
        <form onSubmit={registar} className="space-y-2">
          <label className="block text-xs text-secundario">
            Dia e hora da chamada
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
            />
          </label>
          <label className="block text-xs text-secundario">
            Nota da chamada (opcional)
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAAdicionar(false)} className="flex-1 rounded-full bg-black/5 py-2.5 text-sm font-medium text-secundario">
              Cancelar
            </button>
            <button type="submit" disabled={aGuardar} className="flex-1 rounded-full bg-tinta py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
              {aGuardar ? "A guardar..." : "Guardar chamada"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={abrirAdicionar} className="w-fit rounded-full bg-tinta px-4 py-1.5 text-sm font-semibold text-white hover:bg-black">
          Adicionar chamada
        </button>
      )}
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
              {edicao?.id === c.id ? (
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block text-xs text-secundario">
                    Data e hora
                    <input
                      type="datetime-local"
                      value={edicao.quando}
                      onChange={(e) => setEdicao({ ...edicao, quando: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
                    />
                  </label>
                  <label className="block text-xs text-secundario">
                    Nota
                    <textarea
                      value={edicao.nota}
                      onChange={(e) => setEdicao({ ...edicao, nota: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEdicao(null)} className="flex-1 rounded-lg bg-black/5 py-1.5 text-xs font-medium text-secundario">
                      Cancelar
                    </button>
                    <button type="button" onClick={guardarEdicao} className="flex-1 rounded-lg bg-tinta py-1.5 text-xs font-semibold text-white">
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="text-xs text-secundario">
                      {formatarDia(new Date(c.ocorreu_em))} {formatarHora(c.ocorreu_em)}
                    </p>
                    {c.observacoes && <p className="mt-0.5 text-tinta">{c.observacoes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEdicao({ id: c.id, quando: paraCampo(c.ocorreu_em), nota: c.observacoes ?? "" })}
                      className="rounded-full px-2.5 py-1 text-xs font-medium text-azul-escuro hover:bg-black/5"
                    >
                      Editar
                    </button>
                    <button onClick={() => apagar(c)} aria-label="Apagar este registo" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-secundario hover:bg-black/5">
                &times;
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
