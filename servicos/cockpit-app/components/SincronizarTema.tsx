"use client";

import { useEffect } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { aplicarTema, temaGuardado, type Tema } from "@/lib/tema";

// Aplica o aspeto escolhido na conta (se for outro aparelho ou o aparelho ainda não o conhece) e, em "Automático", segue o sistema.
export default function SincronizarTema() {
  useEffect(() => {
    let ativo = true;
    sbBrowser()
      .auth.getSession()
      .then(({ data }) => {
        const t = data.session?.user.user_metadata?.tema as Tema | undefined;
        if (ativo && (t === "claro" || t === "escuro" || t === "auto") && t !== temaGuardado()) aplicarTema(t);
      });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => temaGuardado() === "auto" && aplicarTema("auto");
    mq.addEventListener("change", aoMudar);
    return () => {
      ativo = false;
      mq.removeEventListener("change", aoMudar);
    };
  }, []);
  return null;
}
