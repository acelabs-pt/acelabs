"use client";

import { useRef, useState } from "react";

export type AcaoSwipe = {
  rotulo: string;
  /** Classes de cor do fundo que aparece por baixo, ex: "bg-verde text-white". */
  classe: string;
  onAcao: () => void;
};

const LIMITE = 84; // px a arrastar para disparar a ação
const MAXIMO = 132;

/**
 * Linha que se desliza para os lados. Deslizar para a direita dispara `direita`, para a esquerda dispara `esquerda`.
 * É um atalho: a mesma ação tem de existir também num botão visível, porque o gesto não se descobre sozinho
 * e não funciona com teclado nem leitor de ecrã. O scroll vertical da página continua a funcionar.
 */
export default function SwipeLinha({
  direita,
  esquerda,
  children,
  className = "rounded-2xl",
}: {
  direita?: AcaoSwipe;
  esquerda?: AcaoSwipe;
  children: React.ReactNode;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [arrastar, setArrastar] = useState(false);
  const ini = useRef<{ x: number; y: number; eixo: "h" | "v" | null; id: number } | null>(null);
  const moveu = useRef(false);
  const passou = useRef(false);

  function limitar(v: number) {
    const max = v > 0 ? (direita ? MAXIMO : 0) : esquerda ? MAXIMO : 0;
    const a = Math.abs(v);
    // depois do limite, resistência (arrasta mais devagar)
    const r = a > LIMITE ? LIMITE + (a - LIMITE) * 0.35 : a;
    return Math.sign(v) * Math.min(r, max);
  }

  return (
    <div data-no-swipe className={`relative overflow-hidden ${className}`}>
      {(direita || esquerda) && (
        <div className="pointer-events-none absolute inset-0 flex items-stretch justify-between text-sm font-semibold" aria-hidden="true">
          <div className={`flex w-1/2 items-center justify-start pl-5 ${direita?.classe ?? ""}`} style={{ opacity: dx > 0 ? Math.min(1, dx / 40) : 0 }}>
            {direita?.rotulo}
          </div>
          <div className={`flex w-1/2 items-center justify-end pr-5 ${esquerda?.classe ?? ""}`} style={{ opacity: dx < 0 ? Math.min(1, -dx / 40) : 0 }}>
            {esquerda?.rotulo}
          </div>
        </div>
      )}
      <div
        className="relative"
        style={{
          transform: `translateX(${dx}px)`,
          transition: arrastar ? "none" : "transform 0.22s cubic-bezier(.2,.8,.2,1)",
          touchAction: "pan-y",
          userSelect: arrastar ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          ini.current = { x: e.clientX, y: e.clientY, eixo: null, id: e.pointerId };
          moveu.current = false;
          passou.current = false;
        }}
        onPointerMove={(e) => {
          const s = ini.current;
          if (!s || s.id !== e.pointerId) return;
          const ddx = e.clientX - s.x;
          const ddy = e.clientY - s.y;
          if (s.eixo === null) {
            if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
            s.eixo = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "h" : "v";
            if (s.eixo === "h") {
              e.currentTarget.setPointerCapture(e.pointerId);
              setArrastar(true);
            }
          }
          if (s.eixo !== "h") return;
          moveu.current = true;
          const v = limitar(ddx);
          setDx(v);
          const acima = Math.abs(v) >= LIMITE * 0.98 && (v > 0 ? !!direita : !!esquerda);
          if (acima && !passou.current) {
            passou.current = true;
            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
          } else if (!acima) passou.current = false;
        }}
        onPointerUp={(e) => {
          const s = ini.current;
          ini.current = null;
          if (!s || s.eixo !== "h") return;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* já libertado */
          }
          setArrastar(false);
          const v = dx;
          setDx(0);
          if (v >= LIMITE && direita) direita.onAcao();
          else if (v <= -LIMITE && esquerda) esquerda.onAcao();
        }}
        onPointerCancel={() => {
          ini.current = null;
          setArrastar(false);
          setDx(0);
        }}
        // Depois de arrastar, o "click" que o browser dispara no fim não deve abrir a ligação por baixo.
        onClickCapture={(e) => {
          if (moveu.current) {
            e.preventDefault();
            e.stopPropagation();
            moveu.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
