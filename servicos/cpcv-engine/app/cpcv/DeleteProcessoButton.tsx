"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger } from "./ui";

export default function DeleteProcessoButton({ id }: { id: string }) {
  const router = useRouter();
  const [aEliminar, setAEliminar] = useState(false);
  const [erro, setErro] = useState("");

  async function eliminar() {
    if (!confirm("Eliminar este processo? Esta acção não pode ser desfeita.")) return;
    setAEliminar(true);
    setErro("");
    try {
      const res = await fetch(`/api/cpcv/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Erro ao eliminar.");
        setAEliminar(false);
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de ligação. Confirma a internet e tenta outra vez.");
      setAEliminar(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={eliminar} disabled={aEliminar} className={btnDanger}>
        {aEliminar ? "A eliminar..." : "Eliminar"}
      </button>
      {erro && <span className="text-[10px] text-red-500 max-w-[16ch]">{erro}</span>}
    </span>
  );
}
