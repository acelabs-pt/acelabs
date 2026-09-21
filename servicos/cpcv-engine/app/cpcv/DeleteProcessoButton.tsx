"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger } from "./ui";

export default function DeleteProcessoButton({ id }: { id: string }) {
  const router = useRouter();
  const [aEliminar, setAEliminar] = useState(false);

  async function eliminar() {
    if (!confirm("Eliminar este processo? Esta acção não pode ser desfeita.")) return;
    setAEliminar(true);
    try {
      const res = await fetch(`/api/cpcv/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao eliminar.");
        setAEliminar(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Erro de ligação. Confirma a internet e tenta outra vez.");
      setAEliminar(false);
    }
  }

  return (
    <button onClick={eliminar} disabled={aEliminar} className={btnDanger}>
      {aEliminar ? "A eliminar..." : "Eliminar"}
    </button>
  );
}
