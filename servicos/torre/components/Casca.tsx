"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AvisosProvider } from "./Avisos";
import BotaoMais from "./BotaoMais";
import BotaoPesquisa from "./BotaoPesquisa";
import LargarFaturas from "./LargarFaturas";
import Menu, { Icone, TAMANHOS, type Modo } from "./Navegacao";
import Paleta from "./Paleta";

/** Tudo o que rodeia as páginas: menu lateral (ou gaveta no telemóvel), pesquisa, largar faturas e avisos. */
export default function Casca({ nome, contadores, children }: { nome: string; contadores: { faturas: number; movimentos: number }; children: React.ReactNode }) {
  const [modo, setModo] = useState<Modo>("auto");
  const [gaveta, setGaveta] = useState(false);
  const caminho = usePathname();

  useEffect(() => {
    try {
      const m = localStorage.getItem("torre_menu");
      if (m === "aberta" || m === "fechada") setModo(m);
    } catch {
      /* sem armazenamento: fica no automático */
    }
  }, []);
  useEffect(() => setGaveta(false), [caminho]);
  useEffect(() => {
    document.body.style.overflow = gaveta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [gaveta]);

  function alternar() {
    const largo = window.matchMedia("(min-width: 1024px)").matches;
    const aberto = modo === "aberta" || (modo === "auto" && largo);
    const novo: Modo = aberto ? "fechada" : "aberta";
    setModo(novo);
    try {
      localStorage.setItem("torre_menu", novo);
    } catch {
      /* ignora */
    }
  }

  return (
    <AvisosProvider>
      <Menu modo={modo} nome={nome} contadores={contadores} aoAlternar={alternar} gavetaAberta={gaveta} aoFecharGaveta={() => setGaveta(false)} />
      <Paleta />
      <LargarFaturas />
      <div className={TAMANHOS[modo].margem}>
        {/* Telemóvel: botão do menu, marca e pesquisa; o menu abre de lado. */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-linha bg-[#f5f5f7]/90 px-4 py-2.5 backdrop-blur sm:hidden">
          <button type="button" onClick={() => setGaveta(true)} aria-label="Abrir menu" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-tinta">
            <Icone tamanho={20}>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </Icone>
            {contadores.faturas + contadores.movimentos > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-azul ring-2 ring-[#f5f5f7]" aria-hidden />}
          </button>
          <Link href="/" className="text-lg font-bold tracking-tight text-tinta">
            Torre<span className="text-azul">.</span>
          </Link>
          <BotaoPesquisa />
        </header>
        <main className="mx-auto max-w-5xl space-y-6 px-5 pb-28 pt-6 sm:px-8 sm:pt-10 lg:pb-16">{children}</main>
      </div>
      <BotaoMais />
    </AvisosProvider>
  );
}
