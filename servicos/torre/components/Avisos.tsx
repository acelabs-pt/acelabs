"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Avisos curtos que desaparecem sozinhos (guardado, classificado...), com uma ação opcional ("Aplicar sempre").
// Em vez de mensagens que ficam coladas à página e empurram o resto para baixo.

type Acao = { texto: string; fazer: () => void };
type Aviso = { id: number; texto: string; acao?: Acao };
type Dar = (texto: string, acao?: Acao) => void;

const Contexto = createContext<Dar>(() => {});
export const useAviso = () => useContext(Contexto);

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const tirar = useCallback((id: number) => setLista((l) => l.filter((x) => x.id !== id)), []);
  const dar = useCallback<Dar>(
    (texto, acao) => {
      const id = Date.now() + Math.random();
      setLista((l) => [...l.slice(-2), { id, texto, acao }]);
      setTimeout(() => tirar(id), acao ? 9000 : 4000);
    },
    [tirar],
  );
  return (
    <Contexto.Provider value={dar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {lista.map((a) => (
          <div key={a.id} role="status" className="anim-entrada pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-tinta px-4 py-3 text-sm text-white shadow-lg">
            <span className="min-w-0 flex-1">{a.texto}</span>
            {a.acao && (
              <button
                type="button"
                onClick={() => {
                  a.acao!.fazer();
                  tirar(a.id);
                }}
                className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25"
              >
                {a.acao.texto}
              </button>
            )}
            <button type="button" onClick={() => tirar(a.id)} aria-label="Fechar aviso" className="shrink-0 text-white/60 hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
