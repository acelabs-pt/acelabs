"use client";

import { useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnAccent, btnGhost } from "../ui";

// Mudar a própria password. Serve sobretudo a quem recebeu uma password temporária da Ace Labs (plataforma de controlo).
export default function CpcvContaPage() {
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

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

  const campo = "w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30";

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold text-[#0F172A]">Conta</h1>
      <form onSubmit={mudar} className="mt-4 space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0F172A]">Mudar a password</h2>
        <input type="password" required autoComplete="new-password" placeholder="Nova password (mín. 8)" aria-label="Nova password" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
        <input type="password" required autoComplete="new-password" placeholder="Repete a password" aria-label="Repete a password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={campo} />
        {msg && (
          <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-sm ${msg.tipo === "erro" ? "text-red-600" : "text-[#0F172A]"}`}>
            {msg.texto}
          </p>
        )}
        <button type="submit" disabled={aGuardar} className={`${btnAccent} w-full`}>
          {aGuardar ? "A guardar..." : "Mudar password"}
        </button>
      </form>
      <div className="mt-3">
        <Link href="/cpcv" className={btnGhost}>
          Voltar aos processos
        </Link>
      </div>
    </div>
  );
}
