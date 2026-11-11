"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Metas from "@/components/dashboard/Metas";
import Hoje from "@/components/dashboard/Hoje";
import { carregarDados, type Dados } from "@/lib/painel";
import { contar, garantirTarefasSemanais, type Contagens } from "@/lib/comprador";
import { guardarEcra, lerEcra } from "@/lib/cacheEcra";

export default function DashboardApp() {
  const [dados, setDados] = useState<Dados | null>(() => lerEcra<Dados>("dashboard") ?? null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await carregarDados();
    if (typeof r === "string") setErro(r);
    else {
      setErro(null);
      setDados(r);
      guardarEcra("dashboard", r);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // As tarefas semanais dos compradores (enviar opções, propor visita) criam-se também aqui, ao abrir o Dashboard, e não só quando
  // se abre a lista de compradores. Uma vez por visita à página; se criar alguma, recarrega para aparecerem logo.
  const garantidas = useRef(false);
  useEffect(() => {
    if (!dados || garantidas.current) return;
    garantidas.current = true;
    const imoveisPor = new Map<string, Dados["imoveis"]>();
    for (const i of dados.imoveis) imoveisPor.set(i.comprador_id, [...(imoveisPor.get(i.comprador_id) ?? []), i]);
    const contagens: Record<string, Contagens> = {};
    for (const c of dados.compradores) contagens[c.id] = contar(imoveisPor.get(c.id) ?? []);
    garantirTarefasSemanais(dados.compradores, contagens)
      .then((n) => {
        if (n > 0) carregar();
      })
      .catch(() => {});
  }, [dados, carregar]);

  // O Dashboard tem um fundo branco ligeiramente azulado, para os cartões brancos se destacarem (só nesta página).
  useEffect(() => {
    document.body.dataset.pagina = "dashboard";
    return () => {
      delete document.body.dataset.pagina;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="cabecalho-fixo">
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
          <Hoje dados={dados} aoAtualizar={carregar} />
          <Metas dados={dados} onAlterado={carregar} />
        </>
      )}
    </div>
  );
}
