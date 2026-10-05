"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

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

    router.push("/hoje");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-tinta">Cockpit</h1>
        <p className="text-sm text-secundario">Entrar na tua conta</p>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-black/10 px-4 py-3.5 text-base"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-black/10 px-4 py-3.5 text-base"
        />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={aEnviar}
          className="w-full rounded-2xl bg-azul py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {aEnviar ? "A entrar..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
