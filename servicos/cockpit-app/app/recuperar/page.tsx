"use client";

import Link from "next/link";
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";

export default function RecuperarPassword() {
  const [email, setEmail] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    const { error } = await sbBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nova-password` });
    setAEnviar(false);
    // Resposta igual exista ou não o email, para não revelar quem é cliente. Só o limite de pedidos é dito.
    if (error && /rate|seconds|many/i.test(error.message)) {
      setErro("Já pediste há pouco. Espera uns minutos e tenta outra vez.");
      return;
    }
    setEnviado(true);
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-tinta">Recuperar a password.</h1>
        <p className="mt-4 text-base text-secundario">Escreve o email da tua conta e enviamos um link para escolheres uma nova.</p>

        {enviado ? (
          <div className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5" role="status">
            <p className="text-base text-tinta">Se este email tiver conta, enviámos-lhe um link. Abre-o no mesmo aparelho em que fizeste o pedido.</p>
            <p className="text-sm text-secundario">Não chegou? Vê o lixo eletrónico e espera uns minutos.</p>
            <Link href="/login" className="block rounded-full bg-tinta py-3.5 text-center text-base font-semibold text-white">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
            />
            {erro && (
              <p role="alert" className="text-sm text-red-600">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={aEnviar}
              className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {aEnviar ? "A enviar..." : "Enviar link"}
            </button>
            <Link href="/login" className="block pt-1 text-center text-sm text-azul">
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
