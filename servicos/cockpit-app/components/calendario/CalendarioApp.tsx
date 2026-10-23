"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import type { Tarefa } from "@/lib/types";
import { formatarDia, formatarHora, inicioDaSemana, inicioDoDia, somarDias, somarMeses } from "@/lib/datas";
import { doDia, ocorrencia, type Ocorrencia } from "@/lib/calendario";
import { adiarTarefa, marcarTarefa } from "@/lib/tarefas";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import AdiarFolha from "@/components/gestos/AdiarFolha";
import { useSwipeNav } from "@/components/gestos/useGestos";
import Mes from "@/components/calendario/Mes";
import Tempo from "@/components/calendario/Tempo";
import DetalheItem from "@/components/calendario/DetalheItem";
import NovoItem, { type NovoValores } from "@/components/calendario/NovoItem";

type Vista = "tarefas" | "dia" | "semana" | "mes";

const ORIGEM_LABEL: Record<Tarefa["origem"], string> = {
  manual: "",
  meta: "Meta",
  comprador: "Comprador",
  proprietario: "Proprietário",
  angariacao: "Angariação",
};

function titulo(vista: Vista, ref: Date): string {
  if (vista === "mes") return ref.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  if (vista === "dia") return ref.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  const ini = inicioDaSemana(ref);
  const fim = somarDias(ini, 6);
  const mesmoMes = ini.getMonth() === fim.getMonth();
  const a = ini.toLocaleDateString("pt-PT", mesmoMes ? { day: "numeric" } : { day: "numeric", month: "short" });
  const b = fim.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  return `${a} - ${b} ${fim.getFullYear()}`;
}

export default function CalendarioApp() {
  const [vista, setVista] = useState<Vista>("mes");
  const [ref, setRef] = useState(() => inicioDoDia(new Date()));
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [novo, setNovo] = useState<Date | null>(null);
  const [adiar, setAdiar] = useState<Tarefa | null>(null);
  const [tipoNovo, setTipoNovo] = useState<"tarefa" | "evento">("evento");
  // Na lista de tarefas só vêm as mais recentes em atraso; este é o total real.
  const [totalAtrasadas, setTotalAtrasadas] = useState(0);

  // "Nova tarefa" do botão + vem com ?novo=tarefa
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "tarefa") {
      setVista("tarefas");
      setTipoNovo("tarefa");
      setNovo(inicioDoDia(new Date()));
      window.history.replaceState(null, "", "/calendario");
    }
  }, []);

  // Só se carrega o que se está a ver: o período (dia, semana ou mês) ou, na lista, as tarefas mais relevantes.
  // Com centenas de angariações em plano há dezenas de milhares de tarefas e carregá-las todas bloqueava a app.
  const chaveJanela = vista === "tarefas" ? "tarefas" : `${vista}:${ref.getTime()}`;
  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setACarregar(true);
      const sb = sbBrowser();
      const base = () => sb.from("tarefas").select("*", { count: "exact" }).eq("no_calendario", true);
      if (vista === "tarefas") {
        const hoje = inicioDoDia(new Date()).toISOString();
        const [atrasadas, proximas, semData, feitas] = await Promise.all([
          base().eq("feita", false).lt("inicio", hoje).order("inicio", { ascending: false }).limit(200),
          base().eq("feita", false).gte("inicio", hoje).order("inicio").limit(300),
          base().eq("feita", false).is("inicio", null).limit(100),
          base().eq("feita", true).order("feita_em", { ascending: false }).limit(10),
        ]);
        if (atrasadas.error || proximas.error || semData.error || feitas.error) setErro("Não foi possível carregar as tarefas.");
        else {
          setTotalAtrasadas(atrasadas.count ?? 0);
          // ordem que a lista espera: mais antigas primeiro
          setTarefas([...(atrasadas.data as Tarefa[]).reverse(), ...(proximas.data as Tarefa[]), ...(semData.data as Tarefa[]), ...(feitas.data as Tarefa[]).reverse()]);
        }
      } else {
        const d0 = inicioDoDia(ref);
        const ini = vista === "dia" ? d0 : vista === "semana" ? inicioDaSemana(d0) : inicioDaSemana(new Date(d0.getFullYear(), d0.getMonth(), 1));
        const fim = somarDias(ini, vista === "dia" ? 1 : vista === "semana" ? 7 : 42);
        const { data, error } = await todas<Tarefa>((de, ate) =>
          base().gte("inicio", ini.toISOString()).lt("inicio", fim.toISOString()).order("inicio").order("id").range(de, ate)
        );
        if (error) setErro("Não foi possível carregar as tarefas.");
        else setTarefas(data);
      }
      setACarregar(false);
    },
    // a janela muda com a vista e com o dia escolhido
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chaveJanela]
  );

  // O spinner só aparece à primeira vez e ao trocar de vista; ao mudar de dia ou de mês recarrega sem piscar.
  const jaCarregou = useRef(false);
  const vistaAnterior = useRef(vista);
  useEffect(() => {
    const mudouVista = vistaAnterior.current !== vista;
    vistaAnterior.current = vista;
    carregar(jaCarregou.current && !mudouVista);
    jaCarregou.current = true;
  }, [carregar, vista]);

  const ocs = useMemo(() => tarefas.map(ocorrencia).filter((o): o is Ocorrencia => o !== null), [tarefas]);

  async function alternarFeita(t: Tarefa) {
    const feita = !t.feita;
    // atualização otimista: a lista responde logo, mesmo com rede lenta
    setTarefas((ts) => ts.map((x) => (x.id === t.id ? { ...x, feita } : x)));
    const e = await marcarTarefa(t, feita);
    if (e) {
      setErro(e);
      carregar(true);
    }
  }

  async function apagar(t: Tarefa) {
    if (!window.confirm(`Apagar "${t.titulo}"?`)) return;
    setAberta(null);
    setTarefas((ts) => ts.filter((x) => x.id !== t.id));
    const { error } = await sbBrowser().from("tarefas").delete().eq("id", t.id);
    if (error) {
      setErro("Não foi possível apagar.");
      carregar(true);
    }
  }

  async function criar(v: NovoValores) {
    setErro(null);
    const { error } = await sbBrowser().from("tarefas").insert(v);
    if (error) return setErro("Não foi possível criar.");
    setNovo(null);
    setTipoNovo("evento");
    if (vista !== "tarefas" && v.inicio) {
      const r = inicioDoDia(new Date(v.inicio));
      if (r.getTime() !== ref.getTime()) {
        setRef(r); // muda a janela e o efeito recarrega
        return;
      }
    }
    await carregar(true);
  }

  function mover(sentido: -1 | 1) {
    setRef((r) => (vista === "mes" ? somarMeses(r, sentido) : somarDias(r, (vista === "semana" ? 7 : 1) * sentido)));
  }

  async function adiarPara(dia: Date) {
    const t = adiar;
    setAdiar(null);
    if (!t) return;
    const e = await adiarTarefa(t, dia);
    if (e) setErro(e);
    await carregar(true);
  }

  const nav = useSwipeNav(mover);
  const itemAberto = tarefas.find((t) => t.id === aberta) ?? null;
  const diaEscolhido = doDia(ocs, ref).sort((a, b) => a.ini.getTime() - b.ini.getTime());
  const botao = "rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow-sm";

  return (
    <div className="space-y-4" {...(vista !== "tarefas" ? nav : {})}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-tinta">Calendário</h1>
        <button
          onClick={() => setNovo(vista === "tarefas" ? inicioDoDia(new Date()) : ref)}
          aria-label="Novo"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-azul text-2xl leading-none text-white"
        >
          +
        </button>
      </div>

      <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
        {([["tarefas", "Tarefas"], ["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, r]) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`flex-1 rounded-lg py-1.5 ${vista === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
          >
            {r}
          </button>
        ))}
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {vista !== "tarefas" && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-lg font-semibold capitalize text-tinta">{titulo(vista, ref)}</h2>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => mover(-1)} aria-label="Anterior" className={botao}>
              &lsaquo;
            </button>
            <button onClick={() => setRef(inicioDoDia(new Date()))} className={botao}>
              Hoje
            </button>
            <button onClick={() => mover(1)} aria-label="Seguinte" className={botao}>
              &rsaquo;
            </button>
          </div>
        </div>
      )}

      {aCarregar ? (
        <p className="text-sm text-secundario">A carregar...</p>
      ) : vista === "tarefas" ? (
        <ListaTarefas tarefas={tarefas} totalAtrasadas={totalAtrasadas} onAlternar={alternarFeita} onApagar={apagar} onAdiar={setAdiar} />
      ) : vista === "mes" ? (
        <>
          <Mes ref_={ref} ocs={ocs} onEscolher={setRef} />
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize text-tinta">{formatarDia(ref)}</h3>
              <button onClick={() => setVista("dia")} className="text-sm font-medium text-azul">
                Abrir dia
              </button>
            </div>
            {diaEscolhido.length === 0 ? (
              <p className="text-sm text-secundario">Nada marcado para este dia.</p>
            ) : (
              <ul className="space-y-2">
                {diaEscolhido.map((o) => (
                  <LinhaTarefa key={o.t.id} t={o.t} onAlternar={alternarFeita} onAdiar={setAdiar} onAbrir={() => setAberta(o.t.id)} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <Tempo
          key={vista}
          dias={vista === "dia" ? [ref] : Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(ref), i))}
          ocs={ocs}
          onSlot={setNovo}
          onItem={(o) => setAberta(o.t.id)}
        />
      )}

      {itemAberto && (
        <DetalheItem
          t={itemAberto}
          onFechar={() => setAberta(null)}
          onAlternar={() => alternarFeita(itemAberto)}
          onApagar={() => apagar(itemAberto)}
        />
      )}
      {adiar && <AdiarFolha titulo={adiar.titulo} onEscolher={adiarPara} onFechar={() => setAdiar(null)} />}
      {novo && <NovoItem key={novo.getTime()} inicial={novo} tipoInicial={tipoNovo} onFechar={() => { setNovo(null); setTipoNovo("evento"); }} onCriar={criar} />}
    </div>
  );
}

function LinhaTarefa({
  t,
  onAlternar,
  onApagar,
  onAdiar,
  onAbrir,
  atrasada,
}: {
  t: Tarefa;
  onAlternar: (t: Tarefa) => void;
  onApagar?: (t: Tarefa) => void;
  onAdiar?: (t: Tarefa) => void;
  onAbrir?: () => void;
  atrasada?: boolean;
}) {
  const hora = t.inicio ? formatarHora(t.inicio) : "";
  return (
    <li>
      <SwipeLinha
        direita={{ rotulo: t.feita ? "Por fazer" : "Feita", classe: t.feita ? "bg-secundario text-white" : "bg-verde text-white", onAcao: () => onAlternar(t) }}
        esquerda={onAdiar && !t.feita ? { rotulo: "Adiar", classe: "bg-azul text-white", onAcao: () => onAdiar(t) } : undefined}
      >
    <div className="flex items-center gap-3 rounded-2xl border border-linha bg-white px-3 py-3">
      <button
        onClick={() => onAlternar(t)}
        aria-label={t.feita ? "Marcar como por fazer" : "Marcar como feita"}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          t.feita ? "border-verde bg-verde text-white" : "border-black/20"
        }`}
      >
        {t.feita && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l4 4 10-10" />
          </svg>
        )}
      </button>
      <button onClick={onAbrir} disabled={!onAbrir} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-base ${t.feita ? "text-secundario line-through" : "text-tinta"}`}>
          {t.tipo === "evento" && <span className="mr-1.5 text-azul">&#9679;</span>}
          {t.titulo}
        </p>
        <p className={`text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
          {[t.inicio ? formatarDia(new Date(t.inicio)) : "Sem data", hora, ORIGEM_LABEL[t.origem]].filter(Boolean).join(" · ")}
        </p>
      </button>
      {onAdiar && !t.feita && (
        <button onClick={() => onAdiar(t)} className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-secundario">
          Adiar
        </button>
      )}
      {onApagar && (
        <button onClick={() => onApagar(t)} aria-label="Apagar" className="p-2 text-secundario">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      )}
    </div>
      </SwipeLinha>
    </li>
  );
}

function ListaTarefas({
  tarefas,
  onAlternar,
  onApagar,
  onAdiar,
  totalAtrasadas,
}: {
  tarefas: Tarefa[];
  onAlternar: (t: Tarefa) => void;
  onApagar: (t: Tarefa) => void;
  onAdiar: (t: Tarefa) => void;
  totalAtrasadas: number;
}) {
  const grupos = useMemo(() => {
    const hoje = inicioDoDia(new Date());
    const amanha = somarDias(hoje, 1);
    const g = { atrasadas: [] as Tarefa[], hoje: [] as Tarefa[], proximas: [] as Tarefa[], semData: [] as Tarefa[], feitas: [] as Tarefa[] };
    for (const t of tarefas) {
      if (t.feita) g.feitas.push(t);
      else if (!t.inicio) g.semData.push(t);
      else {
        const d = new Date(t.inicio);
        if (d < hoje) g.atrasadas.push(t);
        else if (d < amanha) g.hoje.push(t);
        else g.proximas.push(t);
      }
    }
    g.feitas = g.feitas.slice(-10).reverse();
    return g;
  }, [tarefas]);

  const secoes: [string, Tarefa[], boolean][] = [
    ["Em atraso", grupos.atrasadas, true],
    ["Hoje", grupos.hoje, false],
    ["Próximas", grupos.proximas, false],
    ["Sem data", grupos.semData, false],
    ["Feitas (últimas 10)", grupos.feitas, false],
  ];

  if (tarefas.length === 0) {
    return <p className="py-8 text-center text-sm text-secundario">Ainda não há tarefas. Toca no + para adicionar a primeira.</p>;
  }

  return (
    <div className="space-y-5">
      {secoes.map(
        ([titulo, lista, atrasada]) =>
          lista.length > 0 && (
            <section key={titulo}>
              <h2 className={`mb-2 text-sm font-semibold ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                {titulo} ({lista.length}
                {titulo === "Em atraso" && totalAtrasadas > lista.length ? ` de ${totalAtrasadas.toLocaleString("pt-PT")}, as mais recentes` : ""})
              </h2>
              <ul className="space-y-2">
                {lista.map((t) => (
                  <LinhaTarefa key={t.id} t={t} onAlternar={onAlternar} onApagar={onApagar} onAdiar={onAdiar} atrasada={atrasada} />
                ))}
              </ul>
            </section>
          )
      )}
    </div>
  );
}
