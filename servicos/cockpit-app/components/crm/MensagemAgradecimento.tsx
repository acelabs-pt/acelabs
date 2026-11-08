"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";

/** Modelo da mensagem de agradecimento ao cliente depois da reunião (texto definido pelo Miguel). */
export function textoAgradecimento(nomeCliente: string, nomeAgente: string): string {
  const primeiro = nomeCliente.trim().split(/\s+/)[0] || "";
  return (
    `Olá ${primeiro}, só para lhe agradecer a disponibilidade e a sua simpatia. ` +
    `Foi um prazer falarmos um bocadinho e ficar a conhecer o seu imóvel. ` +
    `Fico à sua disposição para o que precisar.\n\n` +
    `Cumprimentos,\n${nomeAgente.trim() || "(Nome do agente)"}`
  );
}

// O texto já vem escrito e pode ser ajustado antes de enviar (as alterações não se guardam).
// A assinatura é o nome do agente que tem sessão iniciada, definido em Conta.
export default function MensagemAgradecimento({ nome, feita = false }: { nome: string; feita?: boolean }) {
  const [aberta, setAberta] = useState(false);
  // Quando a tarefa de agradecimento é dada como feita, o cartão fecha-se sozinho.
  useEffect(() => {
    setAberta(false);
  }, [feita]);
  const [agente, setAgente] = useState<string | null>(null);
  const [editado, setEditado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    sbBrowser()
      .auth.getUser()
      .then(({ data }) => setAgente(((data.user?.user_metadata?.nome as string | undefined) ?? "").trim()));
  }, []);

  const texto = editado ?? textoAgradecimento(nome, agente ?? "");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      {feita ? (
        <button type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta} className="flex w-full items-center justify-between gap-2 text-left">
          <span className="text-sm font-semibold text-tinta">
            Mensagem de agradecimento <span className="ml-1 rounded-full bg-verde px-2 py-0.5 text-[11px] font-medium text-white">feita</span>
          </span>
          <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-secundario transition-transform ${aberta ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : (
        <h3 className="text-sm font-semibold text-tinta">Mensagem de agradecimento</h3>
      )}
      {(!feita || aberta) && (
        <>
      <p className="text-xs text-secundario">Para enviar depois da reunião. Podes ajustar o texto antes de enviar.</p>
      <textarea
        value={texto}
        onChange={(e) => setEditado(e.target.value)}
        rows={8}
        aria-label="Mensagem de agradecimento"
        className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm text-tinta"
      />
      {agente === "" && (
        <p className="text-xs text-secundario">
          Ainda não definiste o teu nome.{" "}
          <Link href="/conta" className="font-medium text-azul-escuro">
            Definir em Conta
          </Link>
        </p>
      )}
      <button type="button" onClick={copiar} className="w-full rounded-full bg-black/5 py-2.5 text-sm font-semibold text-tinta">
        {copiado ? "Copiada" : "Copiar mensagem"}
      </button>
        </>
      )}
    </section>
  );
}
