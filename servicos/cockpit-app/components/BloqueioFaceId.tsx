"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { naApp, pedirFaceId } from "@/lib/nativo";

const CHAVE = "cockpit-faceid"; // "0" = desligado; por omissão está ligado dentro da app
const SEGUNDOS_FORA = 60; // depois deste tempo em segundo plano volta a pedir

export function faceIdLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}
export function definirFaceId(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch {
    // sem armazenamento: fica o valor por omissão
  }
}

const SEM_BLOQUEIO = ["/login", "/recuperar", "/nova-password", "/cliente", "/convite"];

const marca = (ligada: boolean) => {
  if (ligada) document.documentElement.setAttribute("data-bloqueado", "1");
  else document.documentElement.removeAttribute("data-bloqueado");
};

// Dentro da app do iPhone, pede Face ID (ou o código do telemóvel) ao abrir e quando se volta à app depois de mais de um
// minuto em segundo plano. Cobre o ecrã até a pessoa se identificar. Fora da app não faz nada.
export default function BloqueioFaceId() {
  const [bloqueado, setBloqueado] = useState(false);
  const [aPedir, setAPedir] = useState(false);
  const bloqueadoRef = useRef(false);
  bloqueadoRef.current = bloqueado;

  const desbloquear = useCallback(async () => {
    setAPedir(true);
    const certo = await pedirFaceId("Abrir o Cockpit");
    setAPedir(false);
    if (certo) {
      setBloqueado(false);
      marca(false);
    }
  }, []);

  const bloquear = useCallback(() => {
    if (!naApp() || !faceIdLigado() || SEM_BLOQUEIO.some((p) => window.location.pathname.startsWith(p))) {
      marca(false);
      return;
    }
    marca(true);
    setBloqueado(true);
    void desbloquear();
  }, [desbloquear]);

  useEffect(() => {
    if (!naApp()) return;
    bloquear(); // ao abrir a app
    let fundoEm = 0;
    let remover: (() => void) | undefined;
    void import("@capacitor/app").then(({ App }) => {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          fundoEm = Date.now();
          // esconde já o conteúdo: o iOS tira a imagem para o seletor de apps neste momento
          if (faceIdLigado() && !SEM_BLOQUEIO.some((p) => window.location.pathname.startsWith(p))) marca(true);
        } else if (fundoEm && Date.now() - fundoEm > SEGUNDOS_FORA * 1000) bloquear();
        else if (!bloqueadoRef.current) marca(false);
      })
        .then((h) => (remover = () => void h.remove()))
        .catch(() => {}); // plugin indisponível: sem bloqueio ao voltar à app
    }).catch(() => {});
    return () => remover?.();
  }, [bloquear]);

  if (!bloqueado) return null;
  return (
    <div data-bloqueio role="dialog" aria-modal="true" aria-label="Cockpit bloqueado" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#f5f5f7] px-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-tinta">Cockpit</h1>
      <p className="text-base text-secundario">Identifica-te para abrir.</p>
      <button onClick={desbloquear} disabled={aPedir} className="min-h-[48px] rounded-full bg-azul px-8 text-base font-semibold text-white disabled:opacity-60">
        {aPedir ? "A confirmar..." : "Desbloquear"}
      </button>
    </div>
  );
}
