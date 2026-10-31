"use client";

import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { dataLocal, diaDeHoje, type Angariacao } from "@/lib/angariacao";
import { inicioDoDia } from "@/lib/datas";

// Contagens de uma tabela (0 se a tabela ainda não existir)
async function contar(tabela: string, coluna: string | null, angariacaoId: string): Promise<number> {
  let q = sbBrowser().from(tabela).select("id", { count: "exact", head: true }).eq("angariacao_id", angariacaoId);
  if (coluna) q = q.not(coluna, "is", null);
  const { count, error } = await q;
  return error ? 0 : count ?? 0;
}

// Dias de mercado, visitas e propostas, no topo da angariação. "versao" muda quando se regista algo.
export default function ResumoAngariacao({ ang, versao }: { ang: Angariacao; versao: number }) {
  const [visitas, setVisitas] = useState<number | null>(null);
  const [propostas, setPropostas] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [v1, v2, p1, p2] = await Promise.all([
        contar("comprador_imoveis", "visitado_em", ang.id),
        contar("visitas_externas", null, ang.id),
        contar("comprador_imoveis", "proposta_em", ang.id),
        contar("propostas_externas", null, ang.id),
      ]);
      if (!ativo) return;
      setVisitas(v1 + v2);
      setPropostas(p1 + p2);
    })();
    return () => {
      ativo = false;
    };
  }, [ang.id, versao]);

  const inicio = dataLocal(ang.inicio);
  const fim = ang.vendido_em ? dataLocal(ang.vendido_em) : inicioDoDia(new Date());
  const dias = Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1);
  const naoComecou = !ang.vendido_em && diaDeHoje(ang.inicio) < 1;

  const quadros = [
    {
      rotulo: "Dias de mercado",
      valor: naoComecou ? "0" : String(dias),
      nota: ang.vendido_em ? "até à venda" : naoComecou ? "ainda não começou" : `de ${ang.duracao_dias} do contrato`,
    },
    { rotulo: "Visitas", valor: visitas == null ? "-" : String(visitas), nota: null },
    { rotulo: "Propostas", valor: propostas == null ? "-" : String(propostas), nota: null },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {quadros.map((q) => (
        <div key={q.rotulo} className="quadro-glossy rounded-2xl p-3">
          <p className="text-xs font-medium text-secundario">{q.rotulo}</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-tinta">{q.valor}</p>
          {q.nota && <p className="text-[11px] text-secundario">{q.nota}</p>}
        </div>
      ))}
    </div>
  );
}
