"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ESQUEMAS, modeloCsv, type Entidade } from "@/lib/importar/esquemas";
import { lerFicheiro } from "@/lib/importar/ficheiro";
import { mapearAutomatico, validar, type Mapeamento } from "@/lib/importar/validar";
import { carregarExistentes, gravar, type Progresso } from "@/lib/importar/gravar";
import type { Existentes } from "@/lib/importar/validar";
import { atualizarTodas } from "@/lib/oportunidades";

const ENTIDADES: Entidade[] = ["compradores", "proprietarios", "angariacoes"];
const DESTINO: Record<Entidade, string> = { compradores: "/crm/compradores", proprietarios: "/crm/proprietarios", angariacoes: "/angariacoes" };
const cartao = "space-y-4 rounded-3xl border border-linha bg-white p-5";

function descarregarModelo(e: Entidade) {
  const url = URL.createObjectURL(new Blob([modeloCsv(e)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo-${e}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Fase = "escolher" | "rever" | "a-gravar" | "feito";

export default function ImportarApp() {
  const [entidade, setEntidade] = useState<Entidade>("compradores");
  const [fase, setFase] = useState<Fase>("escolher");
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [existentes, setExistentes] = useState<Existentes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(false);
  const [montarPlano, setMontarPlano] = useState(true);
  const [soFuturas, setSoFuturas] = useState(true);
  const [progresso, setProgresso] = useState<Progresso>({ feitas: 0, total: 0, fase: "" });
  const [resultado, setResultado] = useState<{ importadas: number; alertas: number; erro: string | null } | null>(null);

  const esquema = ESQUEMAS[entidade];
  const validadas = useMemo(
    () => (existentes ? validar(entidade, linhas, mapa, existentes) : []),
    [entidade, linhas, mapa, existentes]
  );
  const prontas = validadas.filter((l) => l.erros.length === 0 && !l.duplicada);
  const comErros = validadas.filter((l) => l.erros.length > 0);
  const repetidas = validadas.filter((l) => l.erros.length === 0 && l.duplicada);
  const faltaObrigatoria = esquema.colunas.filter((c) => c.obrigatoria && mapa[c.chave] == null);

  async function escolherFicheiro(f: File | undefined) {
    if (!f) return;
    setErro(null);
    setALer(true);
    try {
      const todas = await lerFicheiro(f);
      if (todas.length < 2) throw new Error("O ficheiro não tem linhas de dados. A primeira linha tem de ser o cabeçalho.");
      const [cab, ...resto] = todas;
      setExistentes(await carregarExistentes());
      setCabecalho(cab.map((c) => c.trim()));
      setLinhas(resto);
      setMapa(mapearAutomatico(entidade, cab));
      setNomeFicheiro(f.name);
      setFase("rever");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o ficheiro.");
    } finally {
      setALer(false);
    }
  }

  async function importar() {
    setFase("a-gravar");
    setProgresso({ feitas: 0, total: prontas.length, fase: "A começar" });
    const r = await gravar(entidade, prontas, { montarPlano, soAcoesFuturas: soFuturas }, setProgresso);
    let alertas = 0;
    if (r.importadas > 0) {
      setProgresso((p) => ({ ...p, fase: "A procurar imóveis para os compradores" }));
      try {
        alertas = await atualizarTodas();
      } catch {
        /* os alertas podem ser procurados mais tarde, ao guardar uma ficha */
      }
    }
    setResultado({ importadas: r.importadas, alertas, erro: r.erro });
    setFase("feito");
  }

  function recomecar() {
    setFase("escolher");
    setLinhas([]);
    setCabecalho([]);
    setResultado(null);
    setErro(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Importar</h1>
        <p className="text-sm text-secundario">Traz a tua lista do Excel ou do Google Sheets para o Cockpit.</p>
      </div>
      {erro && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {fase === "escolher" && (
        <section className={cartao}>
          <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium" role="group" aria-label="O que queres importar">
            {ENTIDADES.map((e) => (
              <button
                key={e}
                onClick={() => setEntidade(e)}
                aria-pressed={entidade === e}
                className={`flex-1 rounded-lg py-2 ${entidade === e ? "bg-white text-tinta shadow-sm" : "text-tinta/70"}`}
              >
                {ESQUEMAS[e].titulo}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-tinta">1. Prepara a folha</p>
            <p className="text-sm text-secundario">
              A primeira linha tem os nomes das colunas. Podes usar o nosso modelo ou o teu ficheiro: reconhecemos os nomes mais comuns e podes ligar as colunas no passo seguinte.
            </p>
            <button onClick={() => descarregarModelo(entidade)} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
              Descarregar modelo ({esquema.titulo.toLowerCase()})
            </button>
            <details className="text-sm text-secundario">
              <summary className="cursor-pointer text-azul">Ver as colunas</summary>
              <ul className="mt-2 space-y-1">
                {esquema.colunas.map((c) => (
                  <li key={c.chave}>
                    <b className="text-tinta">{c.rotulo}</b>
                    {c.obrigatoria ? " (obrigatória)" : ""}
                    {c.ajuda ? `: ${c.ajuda}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-tinta">2. Escolhe o ficheiro</p>
            <p className="text-sm text-secundario">No Google Sheets: Ficheiro, Transferir, CSV. No Excel serve .xlsx ou CSV.</p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-black/15 px-4 py-8 text-center hover:bg-azul-suave">
              <span className="text-base font-semibold text-tinta">{aLer ? "A ler o ficheiro..." : "Escolher ficheiro"}</span>
              <span className="text-xs text-secundario">.xlsx ou .csv</span>
              <input
                type="file"
                accept=".xlsx,.csv,.txt,.tsv"
                disabled={aLer}
                onChange={(e) => escolherFicheiro(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
          </div>
        </section>
      )}

      {fase === "rever" && (
        <>
          <section className={cartao}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-tinta">Ligar as colunas</h2>
                <p className="truncate text-sm text-secundario">
                  {nomeFicheiro}, {linhas.length} linhas
                </p>
              </div>
              <button onClick={recomecar} className="shrink-0 text-sm text-azul">
                Trocar ficheiro
              </button>
            </div>
            <ul className="space-y-2">
              {esquema.colunas.map((c) => (
                <li key={c.chave} className="grid grid-cols-2 items-center gap-3">
                  <span className="text-sm text-tinta">
                    {c.rotulo}
                    {c.obrigatoria && <span className="text-red-600"> *</span>}
                  </span>
                  <select
                    aria-label={`Coluna do ficheiro para ${c.rotulo}`}
                    value={mapa[c.chave] ?? ""}
                    onChange={(e) => setMapa((m) => ({ ...m, [c.chave]: e.target.value === "" ? null : Number(e.target.value) }))}
                    className="w-full rounded-xl border border-linha bg-white px-3 py-2 text-sm text-tinta"
                  >
                    <option value="">Não importar</option>
                    {cabecalho.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(coluna ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {faltaObrigatoria.length > 0 && (
              <p className="rounded-xl bg-ambar-fundo px-3 py-2 text-sm text-ambar-texto">
                Falta ligar: {faltaObrigatoria.map((c) => c.rotulo).join(", ")}.
              </p>
            )}
          </section>

          <section className={cartao}>
            <h2 className="text-lg font-semibold text-tinta">Resultado da verificação</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-verde-suave p-3">
                <p className="text-2xl font-bold text-tinta">{prontas.length}</p>
                <p className="text-xs text-secundario">prontas</p>
              </div>
              <div className="rounded-2xl bg-ambar-fundo p-3">
                <p className="text-2xl font-bold text-ambar-texto">{repetidas.length}</p>
                <p className="text-xs text-secundario">já existem</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-700">{comErros.length}</p>
                <p className="text-xs text-secundario">com erros</p>
              </div>
            </div>

            {comErros.length > 0 && (
              <details open={comErros.length <= 8}>
                <summary className="cursor-pointer text-sm font-medium text-tinta">Linhas com erros (não são importadas)</summary>
                <ul className="mt-2 space-y-1.5">
                  {comErros.slice(0, 50).map((l) => (
                    <li key={l.n} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      <b>Linha {l.n}:</b> {l.erros.join("; ")}
                    </li>
                  ))}
                  {comErros.length > 50 && <li className="text-xs text-secundario">E mais {comErros.length - 50} linhas.</li>}
                </ul>
              </details>
            )}
            {repetidas.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-tinta">Já existem (ficam de fora)</summary>
                <ul className="mt-2 space-y-1.5">
                  {repetidas.slice(0, 50).map((l) => (
                    <li key={l.n} className="rounded-xl bg-ambar-fundo px-3 py-2 text-sm text-ambar-texto">
                      <b>Linha {l.n}:</b> {l.duplicada}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {validadas.some((l) => l.avisos.length > 0 && l.erros.length === 0 && !l.duplicada) && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-tinta">
                  Avisos ({validadas.filter((l) => l.avisos.length > 0 && l.erros.length === 0 && !l.duplicada).length}), importam na mesma
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {validadas
                    .filter((l) => l.avisos.length > 0 && l.erros.length === 0 && !l.duplicada)
                    .slice(0, 30)
                    .map((l) => (
                      <li key={l.n} className="text-sm text-secundario">
                        <b className="text-tinta">Linha {l.n}:</b> {l.avisos.join("; ")}
                      </li>
                    ))}
                </ul>
              </details>
            )}

            {entidade === "angariacoes" && (
              <div className="space-y-2 rounded-2xl bg-black/[0.04] p-3">
                <label className="flex items-start gap-2 text-sm text-tinta">
                  <input type="checkbox" checked={montarPlano} onChange={(e) => setMontarPlano(e.target.checked)} className="mt-1" />
                  <span>Montar o plano de ações de cada angariação e pôr no calendário</span>
                </label>
                {montarPlano && (
                  <label className="flex items-start gap-2 text-sm text-tinta">
                    <input type="checkbox" checked={soFuturas} onChange={(e) => setSoFuturas(e.target.checked)} className="mt-1" />
                    <span>Só criar as ações que ainda estão para vir (recomendado para contratos já a decorrer, para não encher o calendário de atrasos)</span>
                  </label>
                )}
              </div>
            )}

            <button
              onClick={importar}
              disabled={prontas.length === 0 || faltaObrigatoria.length > 0}
              className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              Importar {prontas.length} {prontas.length === 1 ? esquema.singular : esquema.titulo.toLowerCase()}
            </button>
          </section>
        </>
      )}

      {fase === "a-gravar" && (
        <section className={cartao} aria-live="polite">
          <h2 className="text-lg font-semibold text-tinta">A importar...</h2>
          <p className="text-sm text-secundario">{progresso.fase}. Não feches esta página.</p>
          <div className="h-3 overflow-hidden rounded-full bg-black/5" role="progressbar" aria-valuemin={0} aria-valuemax={progresso.total} aria-valuenow={progresso.feitas}>
            <div className="h-full rounded-full bg-azul transition-[width] duration-200" style={{ width: `${progresso.total ? (progresso.feitas / progresso.total) * 100 : 0}%` }} />
          </div>
          <p className="text-sm text-tinta">
            {progresso.feitas} de {progresso.total}
          </p>
        </section>
      )}

      {fase === "feito" && resultado && (
        <section className={cartao}>
          <h2 className="text-lg font-semibold text-tinta">{resultado.erro ? "Importação interrompida" : "Importação concluída"}</h2>
          <p className="text-sm text-tinta">
            {resultado.importadas} {resultado.importadas === 1 ? esquema.singular : esquema.titulo.toLowerCase()} importados.
          </p>
          {resultado.erro && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {resultado.erro} Os que já estavam gravados ficam. Corrige o problema e importa de novo: os repetidos são ignorados.
            </p>
          )}
          {resultado.alertas > 0 && (
            <p className="rounded-2xl bg-azul-suave px-4 py-3 text-sm text-azul-escuro">
              Encontrámos {resultado.alertas} {resultado.alertas === 1 ? "imóvel" : "imóveis"} que podem servir a compradores. Vê no Dashboard.
            </p>
          )}
          <div className="flex gap-2">
            <Link href={DESTINO[entidade]} className="flex-1 rounded-full bg-tinta py-3 text-center text-base font-semibold text-white">
              Ver {esquema.titulo.toLowerCase()}
            </Link>
            <button onClick={recomecar} className="flex-1 rounded-full bg-black/5 py-3 text-base font-medium text-tinta">
              Importar outra lista
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
