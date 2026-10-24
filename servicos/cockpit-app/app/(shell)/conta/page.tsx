"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";

const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";

export default function Conta() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    sbBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function mudar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) return setMsg({ tipo: "erro", texto: "A password precisa de pelo menos 8 caracteres." });
    if (password !== repetir) return setMsg({ tipo: "erro", texto: "As duas passwords não são iguais." });
    setAGuardar(true);
    const { error } = await sbBrowser().auth.updateUser({ password });
    setAGuardar(false);
    if (error) return setMsg({ tipo: "erro", texto: "Não foi possível mudar a password. Sai, volta a entrar e tenta outra vez." });
    setPassword("");
    setRepetir("");
    setMsg({ tipo: "ok", texto: "Password mudada." });
  }

  async function sair() {
    await sbBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Conta</h1>
        <p className="text-sm text-secundario">{email ?? "A carregar..."}</p>
      </div>

      <form onSubmit={mudar} className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Mudar a password</h2>
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
        {msg && (
          <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-sm ${msg.tipo === "erro" ? "text-red-600" : "text-tinta"}`}>
            {msg.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={aGuardar}
          className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {aGuardar ? "A guardar..." : "Mudar password"}
        </button>
      </form>

      <section className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Instalar no telemóvel</h2>
        <p className="text-sm text-secundario">Fica no ecrã inicial como uma app, sem passar pelas lojas.</p>
        <Link href="/instalar" className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
          Ver como
        </Link>
      </section>

      <section className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Importar contactos</h2>
        <p className="text-sm text-secundario">Traz as tuas listas do Excel ou do Google Sheets.</p>
        <Link href="/importar" className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
          Importar lista
        </Link>
      </section>

      <button onClick={sair} className="w-full rounded-full border border-linha bg-white py-3.5 text-base font-semibold text-red-600">
        Sair
      </button>
    </div>
  );
}
