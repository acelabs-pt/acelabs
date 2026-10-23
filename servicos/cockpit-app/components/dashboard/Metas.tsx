"use client";

import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import MetasForm from "@/components/dashboard/MetasForm";
import { sbBrowser } from "@/lib/supabase-browser";
import { corProgresso } from "@/lib/comprador";
import { METRICAS, fmtNum, metaDoPeriodo, plural, type Metas as MetasT, type Periodo } from "@/lib/metricas";
import { faturacaoAcumulada, feitos, type Dados } from "@/lib/painel";
import Anel from "@/components/dashboard/graficos/Anel";
import LinhaFaturacao from "@/components/dashboard/graficos/LinhaFaturacao";
import { inicioDoDia, semanaISO } from "@/lib/datas";

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

          {m.faturacaoAnual != null && (
            <div className="rounded-xl bg-black/[0.04] px-3 py-2.5">
              <p className="text-xs text-secundario">Objetivo de faturação {m.ano}</p>
              <p className="text-lg font-semibold text-tinta">{eur(m.faturacaoAnual)}</p>
              <p className="text-[11px] text-secundario">Comissões recebidas {m.ano}: {eur(fAno.faturado)}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
                <div className={`h-full rounded-full ${corProgresso(fAno.faturado, m.faturacaoAnual)}`} style={{ width: `${Math.min(100, (fAno.faturado / m.faturacaoAnual) * 100)}%` }} />
              </div>
              {m.anual.transacoes != null && m.anual.transacoes > 0 && (
                <p className="text-[11px] text-secundario">
                  Equivale a {eur(m.faturacaoAnual / m.anual.transacoes)} por transação, com {plural(m.anual.transacoes, "transação", "transações")} no ano
                </p>
              )}
              <div className="mt-3">
                <LinhaFaturacao meses={fat.meses} mesAtual={fat.mesAtual} objetivo={m.faturacaoAnual} />
              </div>
            </div>
          )}

          <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
            {METRICAS.map((x) => {
              const feito = f[x.id];
              const anual = m.anual[x.id];
              const meta = anual == null ? null : metaDoPeriodo(anual, periodo, m.semanasUteis);
              return (
                <li key={x.id} className="flex items-center gap-3">
                  <Anel feito={feito} meta={meta} rotulo={x.label} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight text-tinta">{x.label}</p>
                    <p className="text-xs text-secundario">{meta != null ? `de ${fmtNum(meta)}` : "sem meta"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {f.transacoes > 0 && (
            <p className="text-[11px] text-secundario">
              Transações: {f.transCompradores} do lado do comprador (CPCV) + {f.transAngariacoes} do lado da angariação vendida. Um negócio completo conta nas duas.
            </p>
          )}
          {!definidas && <p className="text-xs text-secundario">Ainda não definiste metas. Mostra só o que já fizeste.</p>}
        </>
      )}
    </Cartao>
  );
}
