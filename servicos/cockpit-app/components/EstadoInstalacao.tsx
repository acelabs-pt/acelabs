"use client";

import { useEffect, useState } from "react";

/** True se a app está a correr instalada no ecrã inicial (e não num separador do browser). */
export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Diz, no ecrã "Instalar", se já estás a usar a app instalada ou ainda a ver no browser.
export default function EstadoInstalacao() {
  const [instalada, setInstalada] = useState<boolean | null>(null);
  useEffect(() => setInstalada(estaInstalada()), []);
  if (instalada === null) return null;
  return instalada ? (
    <p className="flex items-center gap-2 rounded-2xl bg-verde-suave px-4 py-3 text-sm font-medium text-tinta" role="status">
      <span className="h-2.5 w-2.5 rounded-full bg-verde" />
      Já estás a usar a app instalada.
    </p>
  ) : (
    <p className="flex items-center gap-2 rounded-2xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto" role="status">
      <span className="h-2.5 w-2.5 rounded-full bg-ambar" />
      Estás a ver no browser. Segue os passos abaixo para instalar.
    </p>
  );
}
