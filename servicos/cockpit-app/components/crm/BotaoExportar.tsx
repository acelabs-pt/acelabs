"use client";

import { useState } from "react";
import { exportarContacto } from "@/lib/exportarContacto";

// Descarrega tudo o que a app guarda sobre esta pessoa (para responder a um pedido de acesso aos dados).
export default function BotaoExportar({ contactoId, nome }: { contactoId: string; nome: string }) {
  const [estado, setEstado] = useState<"parado" | "a-exportar" | "feito" | "erro">("parado");
  return (
    <div className="space-y-1 text-center">
      <button
        onClick={async () => {
          setEstado("a-exportar");
          try {
            await exportarContacto(contactoId, nome);
            setEstado("feito");
          } catch {
            setEstado("erro");
          }
        }}
        disabled={estado === "a-exportar"}
        className="w-full rounded-full border border-linha bg-white py-3 text-sm font-medium text-tinta disabled:opacity-60"
      >
        {estado === "a-exportar" ? "A preparar..." : "Exportar os dados deste contacto"}
      </button>
      <p className="text-xs text-secundario" role="status">
        {estado === "feito" && "Ficheiro descarregado."}
        {estado === "erro" && "Não foi possível exportar. Tenta outra vez."}
        {estado === "parado" && "Descarrega tudo o que a app guarda sobre esta pessoa."}
      </p>
    </div>
  );
}
