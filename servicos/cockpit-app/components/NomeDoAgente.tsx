"use client";

import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { useToast } from "@/components/Toast";

// O nome do agente (para a assinatura das mensagens). Guarda-se na própria conta, por isso acompanha o agente em qualquer aparelho.
export default function NomeDoAgente() {
  const [nome, setNome] = useState("");
  const [guardado, setGuardado] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { avisar } = useToast();

  useEffect(() => {
    sbBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const n = (data.user?.user_metadata?.nome as string | undefined) ?? "";
        setNome(n);
        setGuardado(n);
      });
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    const { error } = await sbBrowser().auth.updateUser({ data: { nome: nome.trim() } });
    setAGuardar(false);
    if (error) return setErro("Não foi possível guardar o nome. Tenta outra vez.");
    setGuardado(nome.trim());
    avisar("Nome guardado.");
  }

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      <h2 className="text-sm font-semibold text-tinta">O teu nome</h2>
      <p className="text-sm text-secundario">Aparece como assinatura nas mensagens, por exemplo na mensagem de agradecimento.</p>
      <form onSubmit={guardar} className="flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do agente"
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-base"
        />
        <button type="submit" disabled={aGuardar || nome.trim() === guardado} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
          {aGuardar ? "A guardar..." : "Guardar"}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
    </section>
  );
}
