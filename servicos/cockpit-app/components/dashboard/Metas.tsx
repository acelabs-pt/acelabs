"use client";

import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import MetasForm from "@/components/dashboard/MetasForm";
import { sbBrowser } from "@/lib/supabase-browser";
import { corProgresso } from "@/lib/comprador";
import { METRICAS, fmtNum, metaDoPeriodo, plural, type Metas as MetasT, type Periodo } from "@/lib/metricas";
import { faturacaoAcumulada, feitos, type Dados } from "@/lib/painel";
import AneisAtividade from "@/components/dashboard/graficos/AneisAtividade";
import AreaFaturacao from "@/components/dashboard/graficos/AreaFaturacao";
import { inicioDoDia, semanaISO } from "@/lib/datas";

// Azul, verde, âmbar e tinta: as cores da marca, sempre pela mesma ordem (visitas, reuniões, angariações, transações)
const CORES_ANEL = ["#0071e3", "#1fae5a", "#ff9f0a", "#1d1d1f"];
const eur = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} €`;

const PERIODOS: [Periodo, string][] = [
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["trimestre", "Trimestre"],
  ["ano", "Ano"],
];

export default function Metas({ dados, onAlterado }: { dados: Dados; onAlterado: () => void }) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [editar, setEditar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const m = dados.metas;
  const definidas = Object.values(m.anual).some((v) => v != null) || m.faturacaoAnual != null;
  const f = feitos(dados, periodo);
  const fAno = feitos(dados, "ano");
  const fat = faturacaoAcumulada(dados, m.ano);

  const metaSemanal = (k: "visitas" | "reunioes_angariacao") => (m.anual[k] == null ? 0 : metaDoPeriodo(m.anual[k]!, "semana", m.semanasUteis));

  async function guardar(novas: MetasT) {
    setErro(null);
    const sb = sbBrowser();
    const linhas = METRICAS.map((x) => ({
      ano: novas.ano,
      metrica: x.id,
      valor_anual: Math.round(novas.anual[x.id] ?? 0),
      taxa_conversao: x.id === "visitas" ? novas.visitasPorTransacao : x.id === "reunioes_angariacao" ? novas.reunioesPorAngariacao : null,
    }));
    const r1 = await sb.from("metas").upsert(linhas, { onConflict: "ano,metrica" });
    const r2 = await sb.from("metas_config").upsert({ ano: novas.ano, semanas_uteis: novas.semanasUteis, faturacao_anual: novas.faturacaoAnual });
    if (r1.error || r2.error) return setErro(`Não foi possível guardar as metas. (${(r1.error ?? r2.error)?.message})`);
    setEditar(false);
    onAlterado();
  }

  // Sugestão do desenho: não encher o calendário sozinho; perguntar semana a semana.
  async function decidirSemana(poe: boolean) {
    setErro(null);
    const sb = sbBrowser();
    const semana = semanaISO(new Date());
    if (poe) {
      const v = Math.ceil(metaSemanal("visitas"));
      const r = Math.ceil(metaSemanal("reunioes_angariacao"));
      const partes = [v > 0 ? plural(v, "visita", "visitas") : "", r > 0 ? plural(r, "reunião de angariação", "reuniões de angariação") : ""].filter(Boolean);
      const { error } = await sb.from("tarefas").insert({
        titulo: `Metas da semana: ${partes.join(" e ")}`,
        tipo: "tarefa",
        inicio: inicioDoDia(new Date()).toISOString(),
        origem: "meta",
        chave_automacao: `meta:${semana}`,
      });
      if (error) return setErro("Não foi possível pôr as metas no calendário.");
    }
    const { error } = await sb.from("metas_semanas").upsert({ semana, decisao: poe ? "colocada" : "ignorada" });
    if (error) return setErro("Não foi possível guardar a decisão.");
    onAlterado();
  }

  const perguntar = periodo === "semana" && definidas && dados.decisaoSemana === null && (metaSemanal("visitas") > 0 || metaSemanal("reunioes_angariacao") > 0);

  return (
    <Cartao
      titulo="Metas"
      acao={
        !editar && (
          <button onClick={() => setEditar(true)} className="text-sm font-medium text-azul">
            {definidas ? "Editar metas" : "Definir metas"}
          </button>
        )
      }
    >
      {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {editar ? (
        <MetasForm inicial={m} onGuardar={guardar} onCancelar={() => setEditar(false)} />
      ) : (
        <>
          <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
            {PERIODOS.map(([v, r]) => (
              <button
                key={v}
                onClick={() => setPeriodo(v)}
                className={`flex-1 rounded-lg py-1.5 ${periodo === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
              >
                {r}
              </button>
            ))}
          </div>

          {perguntar && (
            <div className="space-y-2 rounded-xl bg-azul/10 p-3">
              <p className="text-sm text-tinta">
                Queres pôr as metas desta semana no calendário? ({plural(Math.ceil(metaSemanal("visitas")), "visita", "visitas")}, {plural(Math.ceil(metaSemanal("reunioes_angariacao")), "reunião", "reuniões")})
              </p>
              <div className="flex gap-2">
                <button onClick={() => decidirSemana(true)} className="flex-1 rounded-lg bg-azul py-2 text-sm font-semibold text-white">
                  Sim, pôr
                </button>
                <button onClick={() => decidirSemana(false)} className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-tinta">
                  Semana de folga
                </button>
              </div>
            </div>
          )}

          <AneisAtividade
            metricas={METRICAS.map((x, i) => ({
              rotulo: x.label,
              feito: f[x.id],
              meta: m.anual[x.id] == null ? null : metaDoPeriodo(m.anual[x.id]!, periodo, m.semanasUteis),
              cor: CORES_ANEL[i],
            }))}
          />
          {f.transacoes > 0 && (
            <p className="text-[11px] text-secundario">
              Transações: {f.transCompradores} do lado do comprador (CPCV) + {f.transAngariacoes} do lado da angariação vendida. Um negócio completo conta nas duas.
            </p>
          )}

          {m.faturacaoAnual != null && (
            <div className="space-y-3 border-t border-linha pt-5">
              <div>
                <p className="text-sm font-medium text-secundario">Faturação de {m.ano}</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-4xl font-bold tracking-tight text-tinta">{eur(fAno.faturado)}</p>
                  <span className="rounded-full bg-azul-suave px-2.5 py-1 text-xs font-semibold text-azul-escuro">
                    {fAno.faturado > 0 && fAno.faturado / m.faturacaoAnual < 0.01 ? "menos de 1" : Math.round((fAno.faturado / m.faturacaoAnual) * 100)}% do objetivo
                  </span>
                </div>
                <p className="text-xs text-secundario">
                  de {eur(m.faturacaoAnual)} (objetivo do ano)
                  {m.anual.transacoes != null && m.anual.transacoes > 0 ? `, ${eur(m.faturacaoAnual / m.anual.transacoes)} por transação em ${plural(m.anual.transacoes, "transação", "transações")}` : ""}
                </p>
              </div>
              <AreaFaturacao meses={fat.meses} mesAtual={fat.mesAtual} objetivo={m.faturacaoAnual} />
            </div>
          )}
          {!definidas && <p className="text-xs text-secundario">Ainda não definiste metas. Mostra só o que já fizeste.</p>}
        </>
      )}
    </Cartao>
  );
}
