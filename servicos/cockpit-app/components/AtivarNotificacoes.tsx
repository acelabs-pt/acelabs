"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { desligarPush, estadoPush, ligarPush, type EstadoPush } from "@/lib/push";
import { enviarTesteNativo, naApp } from "@/lib/nativo";

const TEXTO: Record<EstadoPush, string> = {
  "nao-suportado": "Este browser não suporta notificações. No iPhone é preciso iOS 16.4 ou mais recente.",
  "instalar-primeiro": "No iPhone, as notificações só funcionam com o Cockpit instalado no ecrã principal. Instala primeiro e abre pelo ícone.",
  bloqueado: "As notificações estão bloqueadas. Ativa-as em Definições, Notificações, Cockpit.",
  desligado: "Recebe um lembrete antes de cada visita ou reunião e o resumo das tarefas do dia de manhã.",
  ligado: "Ligadas neste telemóvel.",
};

// Cartão "Notificações" (em Conta e em Instalar): mostra o estado neste aparelho e liga/desliga.
export default function AtivarNotificacoes() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    estadoPush().then(setEstado).catch(() => setEstado("nao-suportado"));
  }, []);

  async function ligar() {
    setATrabalhar(true);
    setMsg(null);
    try {
      const erro = await ligarPush();
      if (erro) setMsg({ tipo: "erro", texto: erro });
      setEstado(await estadoPush());
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível ligar as notificações. Tenta outra vez." });
    }
    setATrabalhar(false);
  }

  async function desligar() {
    setATrabalhar(true);
    setMsg(null);
    await desligarPush().catch(() => {});
    setEstado(await estadoPush());
    setATrabalhar(false);
  }

  async function testar() {
    setATrabalhar(true);
    setMsg(null);
    if (naApp()) {
      const erro = await enviarTesteNativo();
      setMsg(erro ? { tipo: "erro", texto: erro } : { tipo: "ok", texto: "Enviada. Deve aparecer daqui a uns segundos." });
      setATrabalhar(false);
      return;
    }
    const res = await fetch("/api/push/teste", { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setMsg(res?.ok ? { tipo: "ok", texto: "Enviada. Deve aparecer daqui a uns segundos." } : { tipo: "erro", texto: body.error ?? "Sem ligação." });
    setATrabalhar(false);
  }

  if (estado === null) return null;

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      <h2 className="text-lg font-semibold text-tinta">Notificações</h2>
      <p className="text-sm text-secundario">{TEXTO[estado]}</p>
      {estado === "instalar-primeiro" && (
        <Link href="/instalar" className="inline-block text-sm font-semibold text-azul">
          Como instalar
        </Link>
      )}
      {estado === "desligado" && (
        <button onClick={ligar} disabled={aTrabalhar} className="min-h-[44px] rounded-full bg-azul px-5 text-sm font-semibold text-white disabled:opacity-60">
          {aTrabalhar ? "A ligar..." : "Ativar notificações"}
        </button>
      )}
      {estado === "ligado" && (
        <div className="flex flex-wrap gap-2">
          <button onClick={testar} disabled={aTrabalhar} className="min-h-[44px] rounded-full bg-azul px-5 text-sm font-semibold text-white disabled:opacity-60">
            Enviar teste
          </button>
          <button onClick={desligar} disabled={aTrabalhar} className="min-h-[44px] rounded-full border border-linha px-5 text-sm font-semibold text-tinta disabled:opacity-60">
            Desligar
          </button>
        </div>
      )}
      {msg && (
        <p className={`text-sm ${msg.tipo === "ok" ? "text-verde" : "text-ambar-texto"}`} role="status">
          {msg.texto}
        </p>
      )}
    </section>
  );
}
