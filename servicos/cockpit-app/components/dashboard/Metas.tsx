"use client";

import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import MetasForm from "@/components/dashboard/MetasForm";
import { sbBrowser } from "@/lib/supabase-browser";
import BarraProgresso, { corDoProgresso } from "@/components/BarraProgresso";
import { METRICAS, fmtNum, metaDoPeriodo, plural, type Metas as MetasT, type Metrica, type Periodo } from "@/lib/metricas";
import { feitos, type Dados } from "@/lib/painel";
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
          <div className="flex gap-2 text-sm font-medium">
            {PERIODOS.map(([v, r]) => (
              <button
                key={v}
                onClick={() => setPeriodo(v)}
                className={`quadro-glossy flex-1 rounded-xl py-2 ${periodo === v ? "text-azul ring-2 ring-azul" : "text-secundario"}`}
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

          {(() => {
            const objFat = m.faturacaoAnual == null ? null : metaDoPeriodo(m.faturacaoAnual, periodo, m.semanasUteis);
            const objAng = m.anual.angariacoes == null ? null : metaDoPeriodo(m.anual.angariacoes, periodo, m.semanasUteis);
            // Um disco por meta principal: o número grande ao centro e o progresso num anel à volta.
            const Principal = ({ rotulo, valor, objetivo, objetivoTexto, fechado }: { rotulo: string; valor: number; objetivo: number | null; objetivoTexto: string; fechado?: number }) => {
              const fracao = objetivo != null && objetivo > 0 ? Math.min(1, valor / objetivo) : 0;
              const texto = rotulo === "Faturação" ? eur(valor) : String(valor);
              // valores mais compridos descem de tamanho para ficarem dentro do anel
              const tamanho = texto.length <= 5 ? "text-2xl sm:text-3xl" : texto.length <= 7 ? "text-xl sm:text-2xl" : "text-[19px] sm:text-[22px]";
              return (
                <div className="disco relative mx-auto flex aspect-square w-full max-w-[150px] items-center justify-center rounded-full">
                  {objetivo != null && objetivo > 0 && (
                    <svg viewBox="0 0 100 100" className="absolute inset-[5%] h-[90%] w-[90%] -rotate-90" aria-hidden="true">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(104,116,140,0.16)" strokeWidth="3" />
                      {fracao > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke={corDoProgresso(fracao)}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${fracao * 289} 289`}
                        />
                      )}
                    </svg>
                  )}
                  <div className="px-3 text-center">
                    <p className="text-[11px] font-medium text-secundario">{rotulo}</p>
                    <p className={`mt-0.5 font-light leading-tight tracking-tight text-tinta ${tamanho}`}>{texto}</p>
                    {fechado != null && (
                      <p className="text-[10px] leading-tight text-secundario">
                        fechados <b className="text-tinta">{eur(fechado)}</b>
                      </p>
                    )}
                    <p className="text-[10px] leading-tight text-secundario">{objetivo != null ? `objetivo: ${objetivoTexto}` : "objetivo por definir"}</p>
                  </div>
                </div>
              );
            };
            // Indicadores secundários, por baixo do disco da respetiva coluna.
            const Secundaria = ({ id }: { id: Metrica }) => {
              const x = METRICAS.find((y) => y.id === id)!;
              const feito = f[x.id];
              const anual = m.anual[x.id];
              const meta = anual == null ? null : metaDoPeriodo(anual, periodo, m.semanasUteis);
              return (
                <div className="quadro-glossy cartao-leve rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                    <span className="text-[13px] leading-tight text-tinta sm:whitespace-nowrap">{x.label}</span>
                    <span className="shrink-0 text-secundario">
                      <b className="text-base text-tinta">{feito}</b>
                      {meta != null ? ` / ${fmtNum(meta)}` : ""}
                    </span>
                  </div>
                  {meta != null && meta > 0 && <BarraProgresso valor={feito} objetivo={meta} />}
                </div>
              );
            };
            return (
              <div className="grid grid-cols-2 items-center gap-3 pt-5">
                <div className="flex min-w-0 flex-col gap-7">
                  <Principal rotulo="Angariações" valor={f.angariacoes} objetivo={objAng} objetivoTexto={objAng == null ? "" : fmtNum(objAng)} />
                  <Principal rotulo="Faturação" valor={f.faturado} objetivo={objFat} objetivoTexto={objFat == null ? "" : eur(objFat)} fechado={f.fechadoValor} />
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  <Secundaria id="reunioes_angariacao" />
                  <Secundaria id="visitas" />
                  <Secundaria id="transacoes" />
                </div>
              </div>
            );
          })()}

          {!definidas && <p className="text-xs text-secundario">Ainda não definiste metas. Mostra só o que já fizeste.</p>}
        </>
      )}
    </Cartao>
  );
}
