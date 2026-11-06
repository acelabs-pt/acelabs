"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { importarExtrato } from "@/app/acoes";
import { euros } from "@/lib/dinheiro";
import { chavesDeDuplicado, detetarSeparador, encontrarCabecalho, interpretar, lerCsv, sugerirMapa, type Mapa } from "@/lib/extrato";
import { aplicarRegras, contaDeSocios } from "@/lib/calculos";
import { data } from "@/lib/texto";
import type { Categoria, Conta, Regra } from "@/lib/tipos";
import { campo, rotulo } from "./ui";

/** Os bancos portugueses exportam muitas vezes em Windows-1252 (acentos estragados se lidos como UTF-8). */
function descodificar(b: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
}

function mapaCompleto(m: Partial<Mapa>): m is Mapa {
  return m.data !== undefined && m.descricao !== undefined && (m.valor !== undefined || (m.debito !== undefined && m.credito !== undefined));
}

export default function Importar({ contas, regras, categorias }: { contas: Conta[]; regras: Regra[]; categorias: Categoria[] }) {
  const [contaId, setContaId] = useState("");
  const [ficheiro, setFicheiro] = useState("");
  const [separador, setSeparador] = useState(";");
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [inicio, setInicio] = useState(0);
  const [mapa, setMapa] = useState<Partial<Mapa>>({});
  const [duasColunas, setDuasColunas] = useState(false);
  const [escolhidas, setEscolhidas] = useState<Set<number>>(new Set());
  const [estado, setEstado] = useState<{ aGravar?: boolean; erro?: string; feito?: string }>({});

  const conta = contas.find((c) => c.id === contaId);
  const nomeCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const cabecalho = linhas[inicio] ?? [];
  const resultado = useMemo(() => (mapaCompleto(mapa) ? interpretar(linhas.slice(inicio + 1), mapa) : { movimentos: [], erros: [] }), [linhas, inicio, mapa]);
  const chaves = useMemo(() => chavesDeDuplicado(contaId, resultado.movimentos), [contaId, resultado.movimentos]);

  function escolherTodas(sim: boolean) {
    setEscolhidas(sim ? new Set(resultado.movimentos.map((_, i) => i)) : new Set());
  }

  async function carregar(f: File) {
    if (!conta) return;
    const texto = descodificar(await f.arrayBuffer());
    const sep = conta.modelo_extrato?.separador ?? detetarSeparador(texto);
    const l = lerCsv(texto, sep);
    const i = encontrarCabecalho(l);
    const guardado = conta.modelo_extrato?.mapa as Partial<Mapa> | undefined;
    const m = guardado && mapaCompleto(guardado) && Object.values(guardado).every((x) => x < (l[i]?.length ?? 0)) ? guardado : sugerirMapa(l[i] ?? []);
    setFicheiro(f.name);
    setSeparador(sep);
    setLinhas(l);
    setInicio(i);
    setMapa(m);
    setDuasColunas(m.valor === undefined && m.debito !== undefined);
    setEstado({});
    // Nas contas da empresa importa-se tudo; nas dos sócios só o que for da Ace Labs, por isso começa sem nada escolhido.
    const n = mapaCompleto(m) ? interpretar(l.slice(i + 1), m).movimentos.length : 0;
    setEscolhidas(contaDeSocios(conta) ? new Set() : new Set(Array.from({ length: n }, (_, k) => k)));
  }

  async function gravar() {
    if (!mapaCompleto(mapa)) return;
    setEstado({ aGravar: true });
    const r = await importarExtrato({
      conta_id: contaId,
      ficheiro,
      separador,
      mapa,
      linhas: [...escolhidas]
        .filter((i) => i < resultado.movimentos.length)
        .sort((a, b) => a - b)
        .map((i) => ({ ...resultado.movimentos[i], chave: chaves[i] })),
    });
    if (r.erro) setEstado({ erro: r.erro });
    else {
      setEstado({ feito: `${r.novas} movimentos novos${r.duplicadas ? `; ${r.duplicadas} já estavam importados e ficaram de fora` : ""}.` });
      setLinhas([]);
    }
  }

  const coluna = (k: keyof Mapa, nome: string) => (
    <div>
      <label className={rotulo} htmlFor={`col-${k}`}>{nome}</label>
      <select
        id={`col-${k}`}
        className={campo}
        value={mapa[k] ?? ""}
        onChange={(e) => setMapa({ ...mapa, [k]: e.target.value === "" ? undefined : Number(e.target.value) })}
      >
        <option value="">Escolher coluna</option>
        {cabecalho.map((c, i) => (
          <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-3xl border border-linha bg-white p-5 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="conta">Conta do extrato</label>
          <select id="conta" className={campo} value={contaId} onChange={(e) => { setContaId(e.target.value); setLinhas([]); setEstado({}); }}>
            <option value="">Escolher conta</option>
            {contas.filter((c) => c.ativa).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="ficheiro">Ficheiro CSV exportado do banco</label>
          <input id="ficheiro" type="file" accept=".csv,.txt,text/csv" disabled={!conta} className={`${campo} file:mr-3 file:rounded-full file:border-0 file:bg-azul-suave file:px-3 file:py-1 file:text-sm file:font-semibold file:text-azul-escuro disabled:opacity-50`} onChange={(e) => e.target.files?.[0] && carregar(e.target.files[0])} />
          <p className="mt-1 text-xs text-secundario">Se o banco só der Excel, abre no Excel e grava como CSV.</p>
        </div>
      </div>

      {estado.feito && (
        <p role="status" className="rounded-xl bg-verde-suave px-4 py-3 text-sm text-tinta">
          {estado.feito} <Link href="/movimentos?sem=categoria" className="font-semibold text-azul">Classificar os que ficaram sem categoria</Link>
        </p>
      )}

      {linhas.length > 0 && conta && (
        <>
          <div className="space-y-4 rounded-3xl border border-linha bg-white p-5">
            <h2 className="text-lg font-semibold text-tinta">Colunas</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={rotulo} htmlFor="inicio">Linha do cabeçalho</label>
                <select id="inicio" className={campo} value={inicio} onChange={(e) => setInicio(Number(e.target.value))}>
                  {linhas.slice(0, 40).map((l, i) => (
                    <option key={i} value={i}>{`${i + 1}: ${l.join(" | ").slice(0, 60)}`}</option>
                  ))}
                </select>
              </div>
              {coluna("data", "Data")}
              {coluna("descricao", "Descrição")}
            </div>
            <fieldset className="space-y-3">
              <legend className={rotulo}>Como vem o valor</legend>
              <div className="flex flex-wrap gap-4 text-base">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!duasColunas} onChange={() => { setDuasColunas(false); setMapa({ data: mapa.data, descricao: mapa.descricao }); }} /> Uma coluna, com sinal
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={duasColunas} onChange={() => { setDuasColunas(true); setMapa({ data: mapa.data, descricao: mapa.descricao }); }} /> Débito e crédito separados
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {duasColunas ? (
                  <>
                    {coluna("debito", "Débito (saídas)")}
                    {coluna("credito", "Crédito (entradas)")}
                  </>
                ) : (
                  coluna("valor", "Valor")
                )}
              </div>
            </fieldset>
          </div>

          {resultado.erros.length > 0 && (
            <p className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">
              {resultado.erros.length} linhas não se perceberam e ficam de fora ({resultado.erros.slice(0, 5).map((e) => `linha ${e.linha}: ${e.motivo}`).join("; ")}
              {resultado.erros.length > 5 ? "..." : ""}).
            </p>
          )}

          <div className="rounded-3xl border border-linha bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-tinta">
                {escolhidas.size} de {resultado.movimentos.length} linhas escolhidas
              </h2>
              <div className="flex gap-2 text-sm font-semibold">
                <button type="button" onClick={() => escolherTodas(true)} className="rounded-full px-3 py-2 text-azul hover:bg-azul-suave">Todas</button>
                <button type="button" onClick={() => escolherTodas(false)} className="rounded-full px-3 py-2 text-azul hover:bg-azul-suave">Nenhuma</button>
              </div>
            </div>
            {contaDeSocios(conta) && <p className="mb-3 text-sm text-secundario">Conta dos sócios: escolhe só as despesas da Ace Labs. Ficam marcadas para a empresa devolver.</p>}
            <ul className="divide-y divide-linha">
              {resultado.movimentos.slice(0, 500).map((m, i) => {
                const r = aplicarRegras(m.descricao, regras);
                return (
                  <li key={i}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={escolhidas.has(i)}
                        onChange={(e) => {
                          const n = new Set(escolhidas);
                          if (e.target.checked) n.add(i);
                          else n.delete(i);
                          setEscolhidas(n);
                        }}
                        className="h-5 w-5 shrink-0"
                      />
                      <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-tinta">{m.descricao}</span>
                        {r?.categoria_id && <span className="text-xs text-secundario">{nomeCat.get(r.categoria_id)}</span>}
                      </span>
                      <span className={`numero shrink-0 text-base ${m.valor > 0 ? "text-verde" : "text-tinta"}`}>{euros(m.valor)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {resultado.movimentos.length > 500 && <p className="mt-2 text-sm text-secundario">A mostrar as primeiras 500; as escolhidas fora da lista também são importadas.</p>}
          </div>

          {estado.erro && <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{estado.erro}</p>}
          <button
            type="button"
            disabled={!escolhidas.size || estado.aGravar}
            onClick={gravar}
            className="min-h-[44px] rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro disabled:opacity-50"
          >
            {estado.aGravar ? "A importar..." : `Importar ${escolhidas.size} movimentos`}
          </button>
        </>
      )}
    </div>
  );
}
