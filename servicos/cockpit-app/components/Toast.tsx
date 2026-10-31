"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Acao = { rotulo: string; onAcao: () => void };
type Aviso = { id: number; texto: string; acao?: Acao };

const Ctx = createContext<{ avisar: (texto: string, acao?: Acao) => void }>({ avisar: () => {} });

/** Mostra uma mensagem curta em baixo, com um botão opcional (ex.: "Desfazer"). Fica 6 segundos. */
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const avisar = useCallback((texto: string, acao?: Acao) => {
    clearTimeout(relogio.current);
    const id = Date.now();
    setAviso({ id, texto, acao });
    relogio.current = setTimeout(() => setAviso((a) => (a?.id === id ? null : a)), 6000);
  }, []);

  return (
    <Ctx.Provider value={{ avisar }}>
      {children}
      {aviso && (
        <div className="print:hidden pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
          <div
            role="status"
            className="anim-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-tinta py-3 pl-4 pr-3 text-sm text-white shadow-lg shadow-black/25"
          >
            <span className="min-w-0 flex-1">{aviso.texto}</span>
            {aviso.acao && (
              <button
                onClick={() => {
                  aviso.acao!.onAcao();
                  setAviso(null);
                }}
                className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25"
              >
                {aviso.acao.rotulo}
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
