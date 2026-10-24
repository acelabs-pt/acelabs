"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { apagarDia } from "@/lib/semRede";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  // quem chega ao login já não tem sessão: a lista do dia guardada para sem rede deixa de fazer sentido
  useEffect(() => apagarDia(), []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);

    const { error } = await sbBrowser().auth.signInWithPassword({ email, password });

    setAEnviar(false);

    if (error) {
      setErro("Email ou password incorretos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-secundario">
          <i className="h-2 w-2 rounded-full bg-verde shadow-[0_0_0_4px_rgba(31,174,90,0.16)]" />
          Ace Labs
        </p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-tight text-tinta">
          Entra no teu Cockpit.
        </h1>
        <p className="mt-4 text-base text-secundario">O teu dia a dia no terreno, num só lugar.</p>

        <div className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5">
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
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {aEnviar ? "A entrar..." : "Entrar"}
          </button>
          <Link href="/recuperar" className="block pt-1 text-center text-sm text-azul">
            Esqueci a password
          </Link>
        </div>
      </form>
    </main>
  );
}
