"use client";

import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnAccent, Spinner } from "../ui";

export default function RegistoPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"agente" | "gestora">("agente");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cpcv/registo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password, role, codigo }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Erro ao criar a conta.");
        setLoading(false);
        return;
      }

      const supabase = sbBrowser();
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError("Conta criada, mas o login falhou. Tenta entrar em /cpcv/login.");
        setLoading(false);
        return;
      }

      window.location.href = "/cpcv";
    } catch {
      setError("Erro de ligação. Confirma a internet e tenta outra vez.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight leading-none">
            cpcv_engine
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">Criar conta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-[0_2px_20px_rgba(0,0,0,0.07)] space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Perfil</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "agente" | "gestora")}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            >
              <option value="agente">Agente imobiliário</option>
              <option value="gestora">Gestora de processos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Código de convite</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className={`w-full ${btnAccent} py-2.5`}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "A criar conta..." : "Criar conta"}
          </button>

          <p className="text-xs text-center text-[#94A3B8]">
            Já tens conta?{" "}
            <a href="/cpcv/login" className="text-[#2E6DB4] font-medium hover:text-[#0059B3] hover:underline transition-colors">
              Entrar
            </a>
          </p>
        </form>

        <p className="text-center text-[10px] text-[#94A3B8] mt-8">Powered by Ace Labs</p>
      </div>
    </div>
  );
}
