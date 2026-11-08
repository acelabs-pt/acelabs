"use client";

import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { aplicarTema, temaGuardado, TEMAS, type Tema } from "@/lib/tema";

// Claro, escuro ou automático. Muda logo a app toda e fica guardado na conta, por isso acompanha o agente em qualquer aparelho.
export default function AspetoDaApp() {
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    setTema(temaGuardado());
  }, []);

  async function escolher(t: Tema) {
    setTema(t);
    aplicarTema(t);
    await sbBrowser().auth.updateUser({ data: { tema: t } });
  }

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5">
      <h2 className="text-sm font-semibold text-tinta">Aspeto</h2>
      <p className="text-sm text-secundario">Escolhe como a app aparece. Em Automático segue o modo do teu telemóvel ou computador.</p>
      <div className="flex rounded-xl bg-azul-suave p-1 text-sm font-medium" role="group" aria-label="Aspeto da app">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => escolher(t.id)}
            aria-pressed={tema === t.id}
            className={`flex-1 rounded-lg py-1.5 ${tema === t.id ? "bg-white font-semibold text-tinta shadow-sm" : "text-azul-escuro"}`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
    </section>
  );
}
