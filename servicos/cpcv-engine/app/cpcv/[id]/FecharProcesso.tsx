"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnAccent, btnDanger, btnGhost, btnSecondary, Spinner } from "../ui";

export default function FecharProcesso({ processoId, estado }: { processoId: string; estado: string }) {
  const router = useRouter();
  const [aCancelar, setACancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  async function fechar(acao: "concluir" | "cancelar") {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch(`/api/cpcv/${processoId}/fechar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, motivo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao fechar o processo.");
        setAEnviar(false);
        return;
      }
      setACancelar(false);
      setMotivo("");
      router.refresh();
    } catch {
      setErro("Erro de ligação. Confirma a internet e tenta outra vez.");
      setAEnviar(false);
    }
  }

  if (estado === "concluido" || estado === "cancelado") return null;

  if (aCancelar) {
    return (
      <div className="w-full flex flex-col items-end gap-2">
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Motivo do cancelamento (opcional)..."
          className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30"
        />
        <div className="flex gap-2">
          <button onClick={() => setACancelar(false)} disabled={aEnviar} className={btnGhost}>
            Voltar
          </button>
          <button onClick={() => fechar("cancelar")} disabled={aEnviar} className={btnDanger}>
            {aEnviar && <Spinner className="h-3.5 w-3.5" />}
            {aEnviar ? "A cancelar..." : "Confirmar cancelamento"}
          </button>
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {estado === "aprovado" && (
          <button onClick={() => fechar("concluir")} disabled={aEnviar} className={btnAccent}>
            {aEnviar && <Spinner className="h-3.5 w-3.5" />}
            {aEnviar ? "A marcar..." : "Marcar como concluído"}
          </button>
        )}
        <button onClick={() => setACancelar(true)} disabled={aEnviar} className={btnSecondary}>
          Cancelar processo
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
