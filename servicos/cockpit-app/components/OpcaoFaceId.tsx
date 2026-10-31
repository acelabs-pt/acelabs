"use client";

import { useEffect, useState } from "react";
import { naApp } from "@/lib/nativo";
import { definirFaceId, faceIdLigado } from "@/components/BloqueioFaceId";

// Em Conta, só dentro da app do iPhone: ligar ou desligar o pedido de Face ID ao abrir.
export default function OpcaoFaceId() {
  const [visivel, setVisivel] = useState(false);
  const [ligado, setLigado] = useState(true);
  useEffect(() => {
    if (!naApp()) return;
    setVisivel(true);
    setLigado(faceIdLigado());
  }, []);
  if (!visivel) return null;
  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      <h2 className="text-sm font-semibold text-tinta">Face ID</h2>
      <label className="flex min-h-[44px] items-center justify-between gap-4 text-base text-tinta">
        Pedir Face ID ao abrir a app
        <input
          type="checkbox"
          checked={ligado}
          onChange={(e) => {
            setLigado(e.target.checked);
            definirFaceId(e.target.checked);
          }}
          className="h-6 w-6 accent-[#0071e3]"
        />
      </label>
      <p className="text-sm text-secundario">Os teus clientes e contactos ficam protegidos se perderes o telemóvel desbloqueado.</p>
    </section>
  );
}
