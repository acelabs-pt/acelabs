"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { estaInstalada } from "@/components/EstadoInstalacao";
import type { Dados } from "@/lib/painel";

const CHAVE = "cockpit-primeiros-passos-escondido";

// Para quem abre o Cockpit pela primeira vez: o que fazer, por ordem, com o estado de cada passo.
// Desaparece sozinho quando tudo está feito, ou quando o utilizador o esconde.
export default function PrimeirosPassos({ dados }: { dados: Dados }) {
  const [escondido, setEscondido] = useState(true); // escondido até se saber (evita um clarão ao carregar)
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    try {
      setEscondido(localStorage.getItem(CHAVE) === "1");
    } catch {
      setEscondido(false);
    }
    setInstalada(estaInstalada());
  }, []);

  const m = dados.metas;
  const passos = [
    {
      titulo: "Trazer os teus contactos",
      ajuda: "Importa a tua lista do Excel ou do Google Sheets, ou cria o primeiro comprador.",
      feito: dados.compradores.length + dados.proprietarios.length > 0,
      href: "/importar",
      rotulo: "Importar",
    },
    {
      titulo: "Criar a primeira angariação",
      ajuda: "Com o imóvel preenchido, o Cockpit avisa quando um comprador combina.",
      feito: dados.angariacoes.length > 0,
      href: "/angariacoes?novo=1",
      rotulo: "Criar",
    },
    {
      titulo: "Definir as metas do ano",
      ajuda: "Visitas, reuniões, angariações e faturação. Aparecem nos anéis do dashboard.",
      feito: Object.values(m.anual).some((v) => v != null) || m.faturacaoAnual != null,
      href: "#metas",
      rotulo: "Definir",
    },
    {
      titulo: "Instalar no telemóvel",
      ajuda: "Fica no ecrã inicial como uma app, sem passar pelas lojas.",
      feito: instalada,
      href: "/instalar",
      rotulo: "Ver como",
    },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  if (escondido || feitos === passos.length) return null;

  function esconder() {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento: fica escondido só até recarregar */
    }
    setEscondido(true);
  }

  return (
    <section className="space-y-4 rounded-3xl border border-linha bg-white p-5" aria-label="Primeiros passos">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-tinta">Primeiros passos</h2>
          <p className="text-sm text-secundario">
            {feitos} de {passos.length} feitos
          </p>
        </div>
        <button onClick={esconder} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-secundario hover:bg-black/5">
          Esconder
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos}>
        <div className="h-full rounded-full bg-azul transition-[width] duration-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <ul className="divide-y divide-black/[0.06]">
        {passos.map((p) => (
          <li key={p.titulo} className="flex items-center gap-3 py-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${p.feito ? "border-verde bg-verde text-white" : "border-black/15"}`}
              aria-hidden="true"
            >
              {p.feito && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${p.feito ? "text-secundario line-through" : "text-tinta"}`}>{p.titulo}</p>
              {!p.feito && <p className="text-xs text-secundario">{p.ajuda}</p>}
            </div>
            {!p.feito &&
              (p.href.startsWith("#") ? (
                <button
                  onClick={() => document.getElementById(p.href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="shrink-0 rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-white"
                >
                  {p.rotulo}
                </button>
              ) : (
                <Link href={p.href} className="shrink-0 rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-white">
                  {p.rotulo}
                </Link>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
