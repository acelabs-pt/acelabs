"use client";

import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnAccent, Spinner } from "../ui";

export default function CpcvLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = sbBrowser();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      // AuthRetryableFetchError = falha de rede/serviço (ex.: Supabase em baixo), não
      // password errada - misturar os dois manda o agente a tentar recuperar a password
      // quando o problema é indisponibilidade do sistema.
      setError(
        loginError.name === "AuthRetryableFetchError"
          ? "Não foi possível ligar ao servidor. Tenta outra vez daqui a pouco."
          : "Email ou password incorrectos."
      );
      setLoading(false);
      return;
    }

    // Navegação completa (não router.push) para o middleware/Server Components
    // lerem já a sessão nova - o mesmo cuidado identificado no login do painel genérico.
    window.location.href = "/cpcv";
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight leading-none">
            cpcv_engine
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-[0_2px_20px_rgba(0,0,0,0.07)] space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
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
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className={`w-full ${btnAccent} py-2.5`}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "A entrar..." : "Entrar"}
          </button>

          <p className="text-xs text-center text-[#94A3B8]">
            Ainda não tens conta?{" "}
            <a href="/cpcv/registo" className="text-[#2E6DB4] font-medium hover:text-[#0059B3] hover:underline transition-colors">
              Criar conta
            </a>
          </p>
        </form>

        <p className="text-center text-[10px] text-[#94A3B8] mt-8">Powered by Ace Labs</p>
      </div>
    </div>
  );
}
