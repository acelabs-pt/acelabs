"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { Resposta } from "@/app/acoes";
import { useAviso } from "./Avisos";

function Enviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-[44px] rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro disabled:opacity-60">
      {pending ? "A guardar..." : texto}
    </button>
  );
}

export function Mensagem({ r }: { r: Resposta | undefined }) {
  // Depois de uma ação que redireciona para a mesma página o estado pode vir vazio.
  if (r?.erro) return <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{r.erro}</p>;
  if (r?.aviso) return <p role="status" className="rounded-xl bg-verde-suave px-4 py-3 text-sm text-tinta">{r.aviso}</p>;
  return null;
}

/**
 * Formulário ligado a uma ação do servidor. Os erros ficam junto ao botão; quando corre bem aparece um aviso curto no
 * canto do ecrã (Avisos.tsx) e os campos limpam-se (se `limpar`).
 */
export function Formulario({
  acao,
  botao,
  children,
  limpar = true,
  className = "space-y-4",
}: {
  acao: (r: Resposta, f: FormData) => Promise<Resposta>;
  botao: string;
  children: React.ReactNode;
  limpar?: boolean;
  className?: string;
}) {
  const [r, enviar] = useFormState(acao, {});
  const ref = useRef<HTMLFormElement>(null);
  const aviso = useAviso();
  useEffect(() => {
    if (r?.aviso) aviso(r.aviso);
    if (r?.ok && limpar) ref.current?.reset();
  }, [r, limpar, aviso]);
  return (
    <form ref={ref} action={enviar} className={className}>
      {children}
      <Mensagem r={r?.erro ? { erro: r.erro } : undefined} />
      <Enviar texto={botao} />
    </form>
  );
}
