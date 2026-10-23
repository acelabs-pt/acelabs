"use client";

import { useEffect } from "react";

// Regista o service worker (necessário para a app ser instalável no Android).
// Só em produção: em desenvolvimento atrapalha o hot reload.
export default function RegistarSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
