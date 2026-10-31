"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deslizar a página para o lado (mudar de dia, mês ou separador). Só conta um gesto claramente horizontal
 * e comprido. Ignora o que começa em campos de escrita, em zonas com scroll próprio (data-no-swipe) e
 * nas linhas deslizáveis (SwipeLinha já se marca com data-no-swipe).
 * Devolve handlers para espalhar no contentor: <div {...nav}>.
 */
export function useSwipeNav(onSwipe: (sentido: -1 | 1) => void) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const alvo = e.target as HTMLElement;
      inicio.current = alvo.closest("[data-no-swipe],input,textarea,select,[role=slider]") ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = inicio.current;
      inicio.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 2) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

/**
 * Puxar uma folha (janela por baixo) para baixo para a fechar. Espalhar `pega` na barrinha do topo
 * e `painel.style` na própria folha. O resto da folha continua a fazer scroll e a receber toques normalmente.
 */
export function useArrastarParaFechar(onFechar: () => void) {
  const [dy, setDy] = useState(0);
  const [arrastar, setArrastar] = useState(false);
  const ini = useRef<number | null>(null);
  return {
    painel: {
      style: { transform: `translateY(${dy}px)`, transition: arrastar ? "none" : "transform 0.22s cubic-bezier(.2,.8,.2,1)" } as React.CSSProperties,
    },
    pega: {
      style: { touchAction: "none" } as React.CSSProperties,
      onPointerDown: (e: React.PointerEvent) => {
        ini.current = e.clientY;
        setArrastar(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (ini.current == null) return;
        setDy(Math.max(0, e.clientY - ini.current));
      },
      onPointerUp: () => {
        const v = dy;
        ini.current = null;
        setArrastar(false);
        if (v > 90) onFechar();
        else setDy(0);
      },
      onPointerCancel: () => {
        ini.current = null;
        setArrastar(false);
        setDy(0);
      },
    },
  };
}

/**
 * Puxar a página para baixo, quando está no topo, para atualizar (a app instalada não tem o gesto do browser).
 * Espalhar `handlers` no contentor e mostrar `puxar` (px) / `aAtualizar` num indicador.
 */
export function usePuxarParaAtualizar(onAtualizar: () => Promise<void> | void) {
  const [puxar, setPuxar] = useState(0);
  const [aAtualizar, setAAtualizar] = useState(false);
  const ini = useRef<{ x: number; y: number } | null>(null);
  const valor = useRef(0);

  useEffect(() => {
    valor.current = puxar;
  }, [puxar]);

  return {
    puxar,
    aAtualizar,
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        const alvo = e.target as HTMLElement;
        const noTopo = (typeof window !== "undefined" ? window.scrollY : 1) <= 0;
        ini.current = noTopo && !alvo.closest("[data-no-swipe],input,textarea,select") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      },
      onTouchMove: (e: React.TouchEvent) => {
        const s = ini.current;
        if (!s || aAtualizar) return;
        const dy = e.touches[0].clientY - s.y;
        const dx = e.touches[0].clientX - s.x;
        if (dy <= 0 || Math.abs(dx) > dy) {
          setPuxar(0);
          return;
        }
        setPuxar(Math.min(80, dy * 0.5));
      },
      onTouchEnd: async () => {
        const v = valor.current;
        ini.current = null;
        if (v >= 56) {
          setAAtualizar(true);
          setPuxar(48);
          try {
            await onAtualizar();
          } finally {
            setAAtualizar(false);
            setPuxar(0);
          }
        } else setPuxar(0);
      },
    },
  };
}
