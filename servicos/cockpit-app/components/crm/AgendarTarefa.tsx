"use client";

import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";

/**
 * Botão "Agendar tarefa" da ficha de um cliente: título, dia e hora. A tarefa fica ligada ao cliente (aparece nos
 * Próximos passos, no Calendário e nos Seguimentos). A chave começa por "manual:" para não se confundir com as automações
 * (que têm a chave do cliente) nem ser apagada com elas.
 */
export default function AgendarTarefa({
  origem,
  clienteId,
  contactoId,
  aoCriar,
}: {
  origem: "comprador" | "proprietario";
  clienteId: string;
  contactoId: string;
  aoCriar: () => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    // por defeito, a próxima meia hora
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    setQuando(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    setTitulo("");
    setErro(null);
    setAberto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const inicio = new Date(quando);
    if (!titulo.trim() || Number.isNaN(inicio.getTime())) return setErro("Escreve a tarefa e escolhe o dia e a hora.");
    setErro(null);
    setAGuardar(true);
    const { error } = await sbBrowser()
      .from("tarefas")
      .insert({
        titulo: titulo.trim(),
        tipo: "tarefa",
        inicio: inicio.toISOString(),
        origem,
        [origem === "comprador" ? "comprador_id" : "proprietario_id"]: clienteId,
        contacto_id: contactoId,
        chave_automacao: `manual:${origem}:${clienteId}:${crypto.randomUUID()}`,
      });
    setAGuardar(false);
    if (error) return setErro("Não foi possível agendar a tarefa.");
    setAberto(false);
    await aoCriar();
  }

  if (!aberto) {
    return (
      <button type="button" onClick={abrir} className="flex w-fit items-center gap-2 rounded-full bg-azul px-4 py-1.5 text-sm font-semibold text-white">
        <span className="text-lg leading-none" aria-hidden="true">+</span>
        Agendar tarefa
      </button>
    );
  }
  return (
    <form onSubmit={guardar} className="space-y-2 rounded-xl bg-black/[0.03] p-3">
      <label className="block text-xs text-secundario">
        Tarefa
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          placeholder="Ex.: Ligar para confirmar a visita"
          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
        />
      </label>
      <label className="block text-xs text-secundario">
        Dia e hora
        <input
          type="datetime-local"
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          required
          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta"
        />
      </label>
      {erro && (
        <p role="alert" className="text-xs text-red-600">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className="flex-1 rounded-lg bg-black/5 py-1.5 text-xs font-medium text-secundario">
          Cancelar
        </button>
        <button type="submit" disabled={aGuardar} className="flex-1 rounded-lg bg-tinta py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {aGuardar ? "A guardar..." : "Agendar"}
        </button>
      </div>
    </form>
  );
}
