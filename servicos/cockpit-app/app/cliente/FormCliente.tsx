"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { escolherCliente, type EstadoCliente } from "./acao";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-60">
      {pending ? "A confirmar..." : "Continuar"}
    </button>
  );
}

export default function FormCliente() {
  const [estado, acao] = useFormState(escolherCliente, { erro: null } as EstadoCliente);
  useEffect(() => {
    if (estado.ok) window.location.assign("/login");
  }, [estado.ok]);
  return (
    <form action={acao} className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5">
      <input
        name="codigo"
        required
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        placeholder="Código da empresa"
        aria-label="Código da empresa"
        className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
      />
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {estado.erro}
        </p>
      )}
      <Botao />
    </form>
  );
}
