"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { Resposta } from "@/app/acoes";
import { Mensagem } from "./Formulario";
import { useAviso } from "./Avisos";

function Botao({ texto, modo, principal }: { texto: string; modo?: string; principal?: boolean }) {
  const { pending } = useFormStatus();
  const cls = principal
    ? "bg-azul text-white hover:bg-azul-escuro"
    : "border border-linha bg-white text-tinta hover:bg-black/5";
  return (
    <button type="submit" name="modo" value={modo ?? ""} disabled={pending} className={`min-h-[44px] rounded-full px-5 text-base font-semibold disabled:opacity-60 ${cls}`}>
      {pending ? "Um momento..." : texto}
    </button>
  );
}

/** Password temporária mostrada uma vez, para ditar ou copiar. */
function Segredo({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div role="status" className="space-y-2 rounded-2xl bg-verde-suave px-4 py-3">
      <p className="text-sm font-medium text-tinta">Password temporária (só aparece agora):</p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="select-all rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-wide text-tinta">{valor}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(valor).then(() => setCopiado(true))}
          className="min-h-[40px] rounded-full border border-linha bg-white px-4 text-sm font-semibold text-tinta hover:bg-black/5"
        >
          {copiado ? "Copiada" : "Copiar"}
        </button>
      </div>
      <p className="text-sm text-secundario">
        Ela entra em cockpit.acelabs.pt com o email e esta password, e depois muda-a em Conta (ou em &ldquo;Esqueci a password&rdquo;, que lhe manda um email).
        Atualiza a página para veres o estado da conta.
      </p>
    </div>
  );
}

/** Formulário de acessos ao Cockpit: um ou mais botões (cada um com o seu modo) e, se vier, a password temporária. */
export function FormAcesso({
  acao,
  botoes,
  children,
}: {
  acao: (r: Resposta, f: FormData) => Promise<Resposta>;
  botoes: { texto: string; modo?: string; principal?: boolean }[];
  children?: React.ReactNode;
}) {
  const [r, enviar] = useFormState(acao, {});
  const aviso = useAviso();
  useEffect(() => {
    if (r?.aviso) aviso(r.aviso);
  }, [r, aviso]);
  return (
    <form action={enviar} className="space-y-4">
      {children}
      <Mensagem r={r?.erro ? { erro: r.erro } : undefined} />
      {r?.segredo && <Segredo valor={r.segredo} />}
      <div className="flex flex-wrap gap-3">
        {botoes.map((b) => (
          <Botao key={b.texto} {...b} />
        ))}
      </div>
    </form>
  );
}
