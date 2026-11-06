"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { juntarFaturas } from "@/lib/fila-faturas";

/**
 * Largar faturas em qualquer ecrã: ao arrastar ficheiros para a janela aparece um aviso a toda a largura e, ao largar, as
 * faturas (PDF ou fotografia) vão para a caixa de faturas, que as lê. Na ficha de um movimento ficam ligadas a esse movimento.
 */
export default function LargarFaturas() {
  const [ativo, setAtivo] = useState(false);
  const caminho = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Na importação de extratos o ficheiro largado é um CSV: não se mete no meio.
    if (caminho.startsWith("/movimentos/importar")) return;
    let dentro = 0;
    const comFicheiros = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const entrar = (e: DragEvent) => {
      if (!comFicheiros(e)) return;
      dentro++;
      setAtivo(true);
    };
    const sair = (e: DragEvent) => {
      if (!comFicheiros(e)) return;
      dentro = Math.max(0, dentro - 1);
      if (!dentro) setAtivo(false);
    };
    const sobre = (e: DragEvent) => {
      if (comFicheiros(e)) e.preventDefault();
    };
    const largar = (e: DragEvent) => {
      if (!comFicheiros(e)) return;
      e.preventDefault();
      dentro = 0;
      setAtivo(false);
      const ficheiros = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
      if (!ficheiros.length) return;
      juntarFaturas(ficheiros);
      window.dispatchEvent(new Event("torre:faturas"));
      if (!document.querySelector("[data-caixa-faturas]")) router.push("/faturas#caixa");
    };
    window.addEventListener("dragenter", entrar);
    window.addEventListener("dragleave", sair);
    window.addEventListener("dragover", sobre);
    window.addEventListener("drop", largar);
    return () => {
      window.removeEventListener("dragenter", entrar);
      window.removeEventListener("dragleave", sair);
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("drop", largar);
    };
  }, [caminho, router]);

  if (!ativo) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-azul/10 p-6 backdrop-blur-[2px]">
      <div className="anim-paleta rounded-3xl border-2 border-dashed border-azul bg-white px-10 py-12 text-center shadow-2xl">
        <p className="text-2xl font-bold tracking-tight text-tinta">Larga as faturas aqui</p>
        <p className="mt-2 text-base text-secundario">PDF ou fotografia. O código QR e a IA preenchem tudo.</p>
      </div>
    </div>
  );
}
