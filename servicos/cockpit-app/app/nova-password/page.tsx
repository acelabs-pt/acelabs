"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";

// Destino dos links de convite e de recuperação. Aceita os dois formatos de link do Supabase:
// "?code=" (o aparelho que pediu tem de ser o mesmo) e "#access_token=" (convites e links gerados pelo administrador).
export default function NovaPassword() {
  const router = useRouter();
  const [estado, setEstado] = useState<"a-validar" | "pronto" | "expirou">("a-validar");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const jaFez = useRef(false);

  useEffect(() => {
    if (jaFez.current) return; // o código só pode ser trocado uma vez
    jaFez.current = true;
    (async () => {
      const sb = sbBrowser();
      const code = new URL(window.location.href).searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.slice(1));
      try {
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
          if (error) throw error;
        }
        const { data } = await sb.auth.getUser();
        if (!data.user) throw new Error("sem sessão");
        window.history.replaceState(null, "", "/nova-password"); // tira o código do endereço
        setEstado("pronto");
      } catch {
        setEstado("expirou");
      }
    })();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (password.length < 8) return setErro("A password precisa de pelo menos 8 caracteres.");
    if (password !== repetir) return setErro("As duas passwords não são iguais.");
    setAGuardar(true);
    const { error } = await sbBrowser().auth.updateUser({ password });
    setAGuardar(false);
    if (error) return setErro("Não foi possível guardar a password. Pede um novo link e tenta outra vez.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-tinta">Escolhe a tua password.</h1>

        {estado === "a-validar" && <p className="mt-6 text-base text-secundario">A validar o link...</p>}

        {estado === "expirou" && (
          <div className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5" role="alert">
            <p className="text-base text-tinta">Este link já não é válido. Os links duram pouco tempo e só funcionam uma vez, no aparelho em que foram pedidos.</p>
            <Link href="/recuperar" className="block rounded-full bg-tinta py-3.5 text-center text-base font-semibold text-white">
              Pedir um link novo
            </Link>
          </div>
        )}

        {estado === "pronto" && (
          <form onSubmit={guardar} className="mt-8 space-y-3 rounded-3xl border border-linha bg-white p-5">
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Nova password (mín. 8)"
              aria-label="Nova password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repete a password"
              aria-label="Repete a password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
            />
            {erro && (
              <p role="alert" className="text-sm text-red-600">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={aGuardar}
              className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {aGuardar ? "A guardar..." : "Guardar e entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
