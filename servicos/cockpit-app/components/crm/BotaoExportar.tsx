"use client";

import { useState } from "react";
import { exportarContacto, exportarFichaExcel, exportarFichaPdf } from "@/lib/exportarContacto";

type Formato = "excel" | "pdf" | "tudo";

// Exportar a ficha: Excel (para um dashboard próprio ou passar a lead a outro consultor) e PDF "Ficha de cliente" (imprimir,
// enviar). Por baixo, discreto, o ficheiro com tudo o que a app guarda sobre a pessoa (pedidos de acesso aos dados).
export default function BotaoExportar({ contactoId, nome, tipo }: { contactoId: string; nome: string; tipo: "compradores" | "proprietarios" }) {
  const [aFazer, setAFazer] = useState<Formato | null>(null);
  const [estado, setEstado] = useState<"parado" | "feito" | "erro">("parado");

  async function exportar(f: Formato) {
    setAFazer(f);
    setEstado("parado");
    try {
      if (f === "excel") await exportarFichaExcel(tipo, contactoId, nome);
      else if (f === "pdf") await exportarFichaPdf(tipo, contactoId, nome);
      else await exportarContacto(contactoId, nome);
      setEstado("feito");
    } catch {
      setEstado("erro");
    } finally {
      setAFazer(null);
    }
  }

  const botao = "flex-1 rounded-full border border-linha bg-white py-3 text-sm font-medium text-tinta disabled:opacity-60";
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm font-semibold text-tinta">Exportar a ficha</p>
      <div className="flex gap-2">
        <button onClick={() => exportar("excel")} disabled={aFazer !== null} className={botao}>
          {aFazer === "excel" ? "A preparar..." : "Excel"}
        </button>
        <button onClick={() => exportar("pdf")} disabled={aFazer !== null} className={botao}>
          {aFazer === "pdf" ? "A preparar..." : "PDF (ficha de cliente)"}
        </button>
      </div>
      <p className="text-xs text-secundario" role="status">
        {estado === "feito" && "Ficheiro descarregado."}
        {estado === "erro" && "Não foi possível exportar. Tenta outra vez."}
        {estado === "parado" && (
          <>
            O Excel abre no Excel e pode ser importado noutro Cockpit.{" "}
            <button onClick={() => exportar("tudo")} disabled={aFazer !== null} className="underline">
              Todos os dados desta pessoa
            </button>{" "}
            (para um pedido de acesso aos dados).
          </>
        )}
      </p>
    </div>
  );
}
