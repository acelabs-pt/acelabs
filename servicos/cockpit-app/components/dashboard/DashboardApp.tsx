"use client";

import { useCallback, useEffect, useState } from "react";
import Seguimentos from "@/components/dashboard/Seguimentos";
import Metas from "@/components/dashboard/Metas";
import { carregarDados, type Dados } from "@/lib/painel";

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

  return (
    <div className="relevo space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-tinta">Dashboard</h1>
        <p className="text-sm text-secundario first-letter:uppercase">
          {new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {!dados ? (
        !erro && <p className="text-sm text-secundario">A carregar...</p>
      ) : (
        <div className="grid items-start gap-8 md:grid-cols-2">
          <div className="mx-auto w-full min-w-0 max-w-xl md:col-span-2">
            <Metas dados={dados} onAlterado={carregar} />
          </div>
          <div className="mx-auto w-full min-w-0 max-w-xl md:col-span-2">
            <Seguimentos dados={dados} />
          </div>
        </div>
      )}
    </div>
  );
}
