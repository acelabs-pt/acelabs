"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, Spinner } from "../ui";

export default function ChatForm({
  processoId,
  temPerguntaPendente,
  estado,
  isGestora,
}: {
  processoId: string;
  temPerguntaPendente: boolean;
  estado: string;
  isGestora: boolean;
}) {
  const router = useRouter();
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (estado === "aprovado" || estado === "concluido" || estado === "cancelado") return null;

  if (!temPerguntaPendente) {
    return (
      <div className="mt-4 rounded-xl bg-[#ECFDF5] text-[#065F46] text-sm px-4 py-3">
        {isGestora
          ? "Já não há perguntas pendentes. Podes aprovar e gerar o CPCV, ou pedir alterações."
          : "Já não há perguntas pendentes. O processo está à espera da aprovação da gestora."}
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!resposta.trim() || enviando) return;
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/cpcv/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId, resposta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro desconhecido.");
        setEnviando(false);
        return;
      }
      setResposta("");
      router.refresh();
    } catch {
      setErro("Erro de rede ao enviar a resposta.");
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={enviar} className="mt-4">
      <p className="text-xs text-[#94A3B8] mb-2">
        Podes responder a todas as perguntas de uma vez, numa única mensagem.
      </p>
      <textarea
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        placeholder="Escreve aqui as respostas a todas as perguntas acima..."
        disabled={enviando}
        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 disabled:bg-[#F8FAFC]"
      />
      <div className="mt-2 flex justify-end">
        <button type="submit" disabled={enviando || !resposta.trim()} className={btnPrimary}>
          {enviando && <Spinner className="h-3.5 w-3.5" />}
          {enviando ? "A enviar..." : "Enviar"}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
    </form>
  );
}
