"use client";

import { useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import { IconeMetas } from "@/components/dashboard/Icones";
import MetasForm from "@/components/dashboard/MetasForm";
import { sbBrowser } from "@/lib/supabase-browser";
import BarraProgresso from "@/components/BarraProgresso";
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

// Indicadores secundários, por baixo das duas metas principais (angariações e faturação)
const SECUNDARIAS: Metrica[] = ["visitas", "reunioes_angariacao", "transacoes"];

export default function Metas({ dados, onAlterado, plano = false }: { dados: Dados; onAlterado: () => void; plano?: boolean }) {
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
      plano={plano}
      icone={<IconeMetas />}
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
          <div className="flex rounded-xl bg-azul-suave p-1 text-sm font-medium" role="group" aria-label="Período">
            {PERIODOS.map(([v, r]) => (
              <button
                key={v}
                onClick={() => setPeriodo(v)}
                aria-pressed={periodo === v}
                className={`flex-1 rounded-lg py-1 ${periodo === v ? "bg-white font-semibold text-tinta shadow-sm" : "text-azul-escuro"}`}
              >
                {r}
              </button>
            ))}
          </div>

          {perguntar && (
            <div className="flex flex-col gap-2 rounded-xl bg-azul/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="min-w-0 text-xs text-tinta sm:flex-1">
                Pôr as metas desta semana no calendário? ({plural(Math.ceil(metaSemanal("visitas")), "visita", "visitas")}, {plural(Math.ceil(metaSemanal("reunioes_angariacao")), "reunião", "reuniões")})
              </p>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => decidirSemana(true)} className="rounded-full bg-azul/15 px-3 py-1 text-xs font-medium text-azul-escuro hover:bg-azul/25">
                  Sim, pôr
                </button>
                <button onClick={() => decidirSemana(false)} className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-secundario hover:bg-white">
                  Semana de folga
                </button>
              </div>
            </div>
          )}

          {(() => {
            const objFat = m.faturacaoAnual == null ? null : metaDoPeriodo(m.faturacaoAnual, periodo, m.semanasUteis);
            const objAng = m.anual.angariacoes == null ? null : metaDoPeriodo(m.anual.angariacoes, periodo, m.semanasUteis);
            const Principal = ({ rotulo, valor, objetivo, objetivoTexto, fechado, semObjetivo }: { rotulo: string; valor: number; objetivo: number | null; objetivoTexto: string; fechado?: number; semObjetivo?: boolean }) => (
              <div className="flex h-full flex-col rounded-2xl quadro-glossy p-3 sm:p-4">
                <p className="text-sm font-medium text-secundario">{rotulo}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-tinta sm:text-4xl">
                  {rotulo === "Faturação" ? eur(valor) : valor}
                </p>
                {/* a mesma linha nos dois cartões (vazia nas Angariações), para o objetivo e a barra ficarem alinhados */}
                <p className={`whitespace-nowrap text-[0.625rem] sm:text-xs ${fechado == null ? "invisible" : "text-secundario"}`} aria-hidden={fechado == null}>
                  negócios fechados <b className="text-tinta">{eur(fechado ?? 0)}</b>
                </p>
                <p className={`text-xs text-secundario sm:text-sm ${semObjetivo ? "invisible" : ""}`} aria-hidden={semObjetivo}>{objetivo != null ? `objetivo: ${objetivoTexto}` : "objetivo por definir"}</p>
                {!semObjetivo && objetivo != null && objetivo > 0 && <BarraProgresso valor={valor} objetivo={objetivo} className="mt-auto h-3.5 pt-0" />}
              </div>
            );
            return (
              <div className="grid grid-cols-2 items-stretch gap-3">
                <Principal rotulo="Angariações" valor={f.angariacoes} objetivo={objAng} objetivoTexto={objAng == null ? "" : fmtNum(objAng)} />
                <Principal rotulo="Faturação" valor={f.faturado} objetivo={objFat} objetivoTexto={objFat == null ? "" : eur(objFat)} fechado={f.fechadoValor} semObjetivo={periodo === "semana"} />
              </div>
            );
          })()}

          <ul className="grid grid-cols-3 gap-3">
            {SECUNDARIAS.map((id) => METRICAS.find((x) => x.id === id)!).map((x) => {
              const feito = f[x.id];
              const anual = m.anual[x.id];
              const meta = anual == null ? null : metaDoPeriodo(anual, periodo, m.semanasUteis);
              return (
                <li key={x.id} className="flex flex-col rounded-xl quadro-glossy px-3 py-2.5">
                  <span className="min-h-[2rem] text-[0.75rem] leading-tight text-tinta sm:min-h-0 sm:text-[0.8125rem]">{x.label}</span>
                  <span className="mt-0.5 text-secundario">
                    <b className="text-base text-tinta">{feito}</b>
                    {meta != null ? ` / ${fmtNum(meta)}` : ""}
                  </span>
                  {meta != null && meta > 0 && <BarraProgresso valor={feito} objetivo={meta} className="mt-1 h-1.5" />}
                </li>
              );
            })}
          </ul>
          {!definidas && <p className="text-xs text-secundario">Ainda não definiste metas. Mostra só o que já fizeste.</p>}
        </>
      )}
    </Cartao>
  );
}
