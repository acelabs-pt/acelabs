"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SeletorLocalizacao, { type Localizacao } from "@/components/crm/SeletorLocalizacao";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import BarraPesquisaFiltros from "@/components/BarraPesquisaFiltros";
import { combina } from "@/lib/pesquisa";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { swipeContacto } from "@/components/gestos/contacto";
import { contarNovasPorComprador } from "@/lib/oportunidades";
import {
  FUNIL,
  OBJETIVOS,
  TIPOLOGIAS,
  TIPOS_IMOVEL,
  alertaLaranja,
  contar,
  garantirTarefasSemanais,
  labelEstado,
  type Comprador,
  type Contagens,
  type EstadoComprador,
  type ImovelComprador,
} from "@/lib/comprador";

// Alertas de imóveis que podem servir ao comprador, ao lado da barra de motivação.
function AlertaImoveis({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="shrink-0 rounded-full bg-azul px-2 py-0.5 text-[11px] font-semibold text-white" title="Imóveis que podem servir, por rever">
      {n} {n === 1 ? "imóvel" : "imóveis"}
    </span>
  );
}

// Escala contínua do vermelho (0) ao verde (10) através do âmbar.
function BarraMotivacao({ valor }: { valor: number | null }) {
  if (valor == null) {
    return <span className="shrink-0 text-[11px] text-secundario/60" title="Motivação por definir">-</span>;
  }
  const cor = `hsl(${(valor / 10) * 120} 70% 42%)`;
  return (
    <span className="flex shrink-0 items-center gap-1" title={`Motivação ${valor}/10`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-black/10">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(valor, 0.5) * 10}%`, backgroundColor: cor }} />
      </span>
      <span className="text-[11px] font-medium tabular-nums" style={{ color: cor }}>{valor}</span>
    </span>
  );
}

export default function ListaCompradores() {
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [contagens, setContagens] = useState<Record<string, Contagens>>({});
  const [novas, setNovas] = useState<Record<string, number>>({});
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState("");
  const [tipologia, setTipologia] = useState("");
  const [local, setLocal] = useState<Localizacao>({ distrito: "", concelho: "", freguesia: "" });
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [motivacaoMin, setMotivacaoMin] = useState("");
  const [soAlertas, setSoAlertas] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [painel, setPainel] = useState(false);
  // Fase vinda de um toque no Dashboard (?fase=cpcv): mostra só essa fase, concluídos incluídos.
  const [fase, setFase] = useState("");
  useEffect(() => {
    setFase(new URLSearchParams(window.location.search).get("fase") ?? "");
  }, []);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [vista, setVista] = useState<"lista" | "funil">("lista");

  useEffect(() => {
    (async () => {
      const sb = sbBrowser();
      const [{ data: cs, error: e1 }, { data: imoveis, error: e2 }] = await Promise.all([
        todas((de, ate) => sb.from("compradores").select("*, contactos(*)").order("created_at", { ascending: false }).order("id").range(de, ate)),
        todas((de, ate) => sb.from("comprador_imoveis").select("*").order("id").range(de, ate)),
      ]);
      if (e1 || e2) {
        setErro("Não foi possível carregar os compradores.");
        setACarregar(false);
        return;
      }
      const lista = cs as unknown as Comprador[];
      const porComprador: Record<string, ImovelComprador[]> = {};
      for (const i of (imoveis ?? []) as ImovelComprador[]) (porComprador[i.comprador_id] ??= []).push(i);
      const cont: Record<string, Contagens> = {};
      for (const c of lista) cont[c.id] = contar(porComprador[c.id] ?? []);
      setNovas(await contarNovasPorComprador());
      setCompradores(lista);
      setContagens(cont);
      setACarregar(false);
      // tarefas semanais automáticas (uma por comprador e semana)
      garantirTarefasSemanais(lista, cont).catch(() => {});
    })();
  }, []);

  const filtradosBase = useMemo(() => {
    return compradores.filter((c) => {
      if (tipo && c.tipo_imovel !== tipo) return false;
      if (tipologia && c.tipologia_minima !== tipologia) return false;
      if (local.distrito && c.distrito !== local.distrito) return false;
      if (local.concelho && c.concelho !== local.concelho) return false;
      if (local.freguesia && c.freguesia !== local.freguesia) return false;
      if (valorMin && (c.expectativa_valor ?? -1) < Number(valorMin)) return false;
      if (valorMax && (c.expectativa_valor ?? Infinity) > Number(valorMax)) return false;
      if (motivacaoMin && (c.motivacao ?? -1) < Number(motivacaoMin)) return false;
      if (soAlertas && !alertaLaranja(c)) return false;
      if (fase && c.estado !== fase) return false;
      if (!combina(pesquisa, [c.contactos.nome, c.contactos.telemovel, c.contactos.email, c.concelho, c.freguesia, c.distrito, c.referencia_imovel])) return false;
      return true;
    });
  }, [compradores, tipo, tipologia, local, valorMin, valorMax, motivacaoMin, soAlertas, fase, pesquisa]);

  // Lista: só em curso. Funil: todas as fases, incluindo concluídos (os perdidos ficam de fora).
  const filtrados = useMemo(
    () => filtradosBase.filter((c) => fase || (c.estado !== "perdido" && c.estado !== "negocio_concluido")),
    [filtradosBase, fase]
  );

  // Só se desenham 60 de cada vez: com mil compradores, desenhar todos demorava vários segundos no telemóvel.
  const [limite, setLimite] = useState(60);
  useEffect(() => {
    setLimite(60);
  }, [filtradosBase]);

  const sel = "rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm";
  const nVisiveis = vista === "lista" ? filtrados.length : filtradosBase.filter((c) => c.estado !== "perdido").length;
  const temFiltros = Boolean(pesquisa || tipo || tipologia || local.distrito || valorMin || valorMax || motivacaoMin || soAlertas);
  function limpar() {
    setTipo("");
    setTipologia("");
    setLocal({ distrito: "", concelho: "", freguesia: "" });
    setValorMin("");
    setValorMax("");
    setMotivacaoMin("");
    setSoAlertas(false);
    setPesquisa("");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex flex-1 rounded-xl bg-black/5 p-1 text-sm font-medium">
          {(["lista", "funil"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`flex-1 rounded-lg py-2 ${vista === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
            >
              {v === "lista" ? "Lista" : "Funil"}
            </button>
          ))}
        </div>
        <Link href="/crm/compradores/novo" className="flex flex-1 items-center justify-center rounded-xl bg-azul px-4 text-sm font-semibold text-white">
          Novo comprador
        </Link>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
        <BarraPesquisaFiltros
          pesquisa={pesquisa}
          onPesquisa={setPesquisa}
          aberto={painel}
          onAlternar={() => setPainel((x) => !x)}
          nAtivos={[tipo, tipologia, local.distrito, valorMin, valorMax, motivacaoMin].filter(Boolean).length + (soAlertas ? 1 : 0)}
        />
        {painel && (
        <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <select value={tipologia} onChange={(e) => setTipologia(e.target.value)} className={sel}>
            <option value="">Tipologia</option>
            {TIPOLOGIAS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={motivacaoMin} onChange={(e) => setMotivacaoMin(e.target.value)} className={sel}>
            <option value="">Motivação</option>
            {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n === 10 ? "10" : `${n} ou mais`}</option>)}
          </select>
          <div className="col-span-2 flex gap-1 md:col-span-1">
            <input value={valorMin} onChange={(e) => setValorMin(e.target.value)} type="number" inputMode="numeric" placeholder="Preço de" className={`${sel} w-1/2 min-w-0`} />
            <input value={valorMax} onChange={(e) => setValorMax(e.target.value)} type="number" inputMode="numeric" placeholder="até" className={`${sel} w-1/2 min-w-0`} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SeletorLocalizacao valor={local} onChange={setLocal} className={`${sel} w-full`} />
        </div>

        {filtrosAbertos && (
          <div className="grid gap-2 border-t border-black/5 pt-2 sm:grid-cols-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={sel}>
              <option value="">Tipo de imóvel</option>
              {TIPOS_IMOVEL.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-2 px-1 text-sm">
              <input type="checkbox" checked={soAlertas} onChange={(e) => setSoAlertas(e.target.checked)} />
              Só com alerta de follow up
            </label>
          </div>
        )}

        </div>
        )}

        <div className="flex items-center justify-between text-xs text-secundario">
          <span>
            {nVisiveis} {nVisiveis === 1 ? "comprador" : "compradores"}
          </span>
          <div className="flex gap-3">
            {painel && (
              <button onClick={() => setFiltrosAbertos((x) => !x)} className="underline">
                {filtrosAbertos ? "Menos filtros" : "Mais filtros"}
              </button>
            )}
            {temFiltros && (
              <button onClick={limpar} className="font-medium text-azul">Limpar</button>
            )}
          </div>
        </div>
      </div>

      {fase && (fase === "perdido" || FUNIL.some((f) => f.id === fase)) && (
        <p className="flex w-fit items-center gap-1 rounded-full bg-azul-suave py-1 pl-3 pr-1 text-sm text-azul-escuro">
          Fase: {labelEstado(fase as EstadoComprador)}
          <button onClick={() => setFase("")} aria-label="Tirar o filtro de fase" className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none hover:bg-white/60">
            &times;
          </button>
        </p>
      )}
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {aCarregar ? (
        <EsqueletoLista />
      ) : vista === "funil" ? (
        <Funil compradores={filtradosBase} contagens={contagens} novas={novas} />
      ) : filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-secundario">
          {compradores.length === 0 ? "Ainda não há compradores. Cria o primeiro." : pesquisa.trim() ? `Nenhum resultado para "${pesquisa.trim()}".` : "Nenhum comprador com estes filtros."}
        </p>
      ) : (
        <>
        <ul className="space-y-2">
          {filtrados.slice(0, limite).map((c) => {
            const n = contagens[c.id] ?? { enviados: 0, visitas: 0, propostas: 0 };
            const alerta = alertaLaranja(c);
            return (
              <li key={c.id}>
                <SwipeLinha {...swipeContacto(c.contactos.telemovel)}>
                <Link href={`/crm/compradores/${c.id}`} className="block rounded-2xl border border-linha bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold text-tinta">{c.contactos.nome}</p>
                        <BarraMotivacao valor={c.motivacao} />
                        <AlertaImoveis n={novas[c.id] ?? 0} />
                      </div>
                      <p className="truncate text-xs text-secundario">
                        {[c.tipo_imovel, c.tipologia_minima, c.concelho || c.distrito].filter(Boolean).join(" · ") || "Sem qualificação"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-azul/10 px-2.5 py-1 text-xs font-medium text-azul">
                      {labelEstado(c.estado)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-secundario">
                    {n.enviados}/{OBJETIVOS.enviados} enviados · {n.visitas}/{OBJETIVOS.visitas} visitas · {n.propostas}/{OBJETIVOS.propostas} propostas
                  </p>
                  {alerta && (
                    <p className="mt-2 rounded-lg bg-ambar-fundo px-2.5 py-1.5 text-xs font-medium text-ambar-texto">{alerta}</p>
                  )}
                </Link>
                </SwipeLinha>
              </li>
            );
          })}
        </ul>
        {filtrados.length > limite && (
          <button
            onClick={() => setLimite((l) => l + 60)}
            className="mt-3 w-full rounded-full bg-black/5 py-3 text-sm font-medium text-tinta"
          >
            Mostrar mais ({filtrados.length - limite} por mostrar)
          </button>
        )}
        </>
      )}
    </div>
  );
}

// Visão de funil: uma coluna por fase, com os compradores dentro. Em telemóvel desliza para o lado.
function Funil({
  compradores,
  contagens,
  novas,
}: {
  compradores: Comprador[];
  contagens: Record<string, Contagens>;
  novas: Record<string, number>;
}) {
  return (
    <div data-no-swipe className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
      <div className="flex gap-3">
        {FUNIL.map((fase) => {
          const daFase = compradores.filter((c) => c.estado === fase.id);
          return (
            <section key={fase.id} className="w-64 shrink-0 rounded-2xl bg-black/[0.04] p-2">
              <h3 className="flex items-center justify-between px-2 py-2 text-xs font-semibold text-tinta">
                <span>{fase.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-secundario shadow-sm">{daFase.length}</span>
              </h3>
              <ul className="space-y-2">
                {daFase.length === 0 && <li className="px-2 py-3 text-xs text-secundario/60">Vazio</li>}
                {daFase.map((c) => {
                  const n = contagens[c.id] ?? { enviados: 0, visitas: 0, propostas: 0 };
                  const alerta = alertaLaranja(c);
                  return (
                    <li key={c.id}>
                      <Link href={`/crm/compradores/${c.id}`} className="block rounded-xl bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-tinta">{c.contactos.nome}</p>
                          <BarraMotivacao valor={c.motivacao} />
                        <AlertaImoveis n={novas[c.id] ?? 0} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-secundario">
                          {[c.tipo_imovel, c.tipologia_minima, c.concelho || c.distrito].filter(Boolean).join(" · ") || "Sem qualificação"}
                        </p>
                        <p className="mt-1.5 text-[11px] text-secundario">
                          {n.enviados} env. · {n.visitas} vis. · {n.propostas} prop.
                        </p>
                        {alerta && (
                          <p className="mt-1.5 rounded-md bg-ambar-fundo px-2 py-1 text-[11px] font-medium text-ambar-texto">{alerta}</p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
