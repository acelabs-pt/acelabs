"use client";

import { useCallback, useEffect, useState } from "react";
import Metas from "@/components/dashboard/Metas";
import Hoje from "@/components/dashboard/Hoje";
import { avisos, carregarDados, type Dados } from "@/lib/painel";

export default function DashboardApp() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await carregarDados();
    if (typeof r === "string") setErro(r);
    else {
      setErro(null);
      setDados(r);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O Dashboard tem um fundo branco ligeiramente azulado, para os cartões brancos se destacarem (só nesta página).
  useEffect(() => {
    document.body.dataset.pagina = "dashboard";
    return () => {
      delete document.body.dataset.pagina;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-tinta">Dashboard</h1>
        <p className="text-sm text-secundario first-letter:uppercase">
          {new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {!dados ? (
        !erro && <p className="text-sm text-secundario">A carregar...</p>
      ) : (
        <>
          <Hoje dados={dados} avisos={avisos(dados)} aoAtualizar={carregar} />
          <Metas dados={dados} onAlterado={carregar} />
        </>
      )}
    </div>
  );
}
