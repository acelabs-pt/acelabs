"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import BarraPesquisaFiltros from "@/components/BarraPesquisaFiltros";
import { combina } from "@/lib/pesquisa";
import SeletorOrdem from "@/components/SeletorOrdem";
import { useToast } from "@/components/Toast";
import { apagarChamada, haQuanto, registarChamadaAgora, ultimosContactos } from "@/lib/contactos";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { swipeContacto } from "@/components/gestos/contacto";
import SeletorLocalizacao, { type Localizacao } from "@/components/crm/SeletorLocalizacao";
import { TIPOLOGIAS, TIPOS_IMOVEL } from "@/lib/comprador";
import { FUNIL_PROP, labelEstadoProp, type EstadoProprietario, type Proprietario } from "@/lib/proprietario";
import { formatarDia, formatarHora } from "@/lib/datas";

type ProximaAcao = { titulo: string; inicio: string };
type FiltroEstado = "seguimento" | "angariado" | "perdido" | "todos";

const SEM_LOCAL: Localizacao = { distrito: "", concelho: "", freguesia: "" };

export default function ListaProprietarios() {
  const [props, setProps] = useState<Proprietario[]>([]);
  const [proximas, setProximas] = useState<Record<string, ProximaAcao>>({});
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [vista, setVista] = useState<"lista" | "funil">("lista");

  const [estado, setEstado] = useState<FiltroEstado>("seguimento");
  const [tipo, setTipo] = useState("");
  const [tipologia, setTipologia] = useState("");
  const [local, setLocal] = useState<Localizacao>(SEM_LOCAL);
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [painel, setPainel] = useState(false);
  const [ultimos, setUltimos] = useState<Record<string, string>>({});
  const [ordem, setOrdem] = useState<"recentes" | "parados" | "valor" | "nome">("recentes");
  const { avisar } = useToast();
  useEffect(() => {
    ultimosContactos().then(setUltimos);
  }, []);
  // Fase vinda de um toque no Dashboard (?fase=fsbo)
  const [fase, setFase] = useState("");
  useEffect(() => {
    setFase(new URLSearchParams(window.location.search).get("fase") ?? "");
  }, []);

  useEffect(() => {
    (async () => {
      const sb = sbBrowser();
      const [r1, r2] = await Promise.all([
        todas((de, ate) => sb.from("proprietarios").select("*, contactos(*)").order("created_at", { ascending: false }).order("id").range(de, ate)),
        todas<{ titulo: string; inicio: string; proprietario_id: string }>((de, ate) =>
          sb
            .from("tarefas")
            .select("titulo, inicio, proprietario_id")
            .not("proprietario_id", "is", null)
            .eq("feita", false)
            .not("inicio", "is", null)
            .order("inicio", { ascending: true })
            .order("id")
            .range(de, ate)
        ),
      ]);
      if (r1.error || r2.error) {
        setErro("Não foi possível carregar os proprietários.");
        setACarregar(false);
        return;
      }
      const prox: Record<string, ProximaAcao> = {};
      for (const t of r2.data ?? []) {
        if (t.proprietario_id && !prox[t.proprietario_id]) prox[t.proprietario_id] = { titulo: t.titulo, inicio: t.inicio! };
      }
      setProps(r1.data as unknown as Proprietario[]);
      setProximas(prox);
      setACarregar(false);
    })();
  }, []);

  const atrasado = (id: string) => {
    const p = proximas[id];
    return Boolean(p && new Date(p.inicio) < new Date());
  };

  // Filtros comuns às duas vistas (exceto o estado, que só se aplica à lista)
  const base = useMemo(
    () =>
      props.filter((p) => {
        if (tipo && p.tipo_imovel !== tipo) return false;
        if (tipologia && p.tipologia !== tipologia) return false;
        if (local.distrito && p.distrito !== local.distrito) return false;
        if (local.concelho && p.concelho !== local.concelho) return false;
        if (local.freguesia && p.freguesia !== local.freguesia) return false;
        if (valorMin && (p.valor ?? -1) < Number(valorMin)) return false;
        if (valorMax && (p.valor ?? Infinity) > Number(valorMax)) return false;
        if (soAtrasados && !atrasado(p.id)) return false;
        if (!combina(pesquisa, [p.contactos.nome, p.contactos.email, p.concelho, p.freguesia, p.distrito], [p.contactos.telemovel])) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, proximas, tipo, tipologia, local, valorMin, valorMax, soAtrasados, pesquisa]
  );

  const lista = useMemo(
    () =>
      base.filter((p) => {
        if (fase) return p.estado === fase;
        if (estado === "todos") return true;
        if (estado === "angariado") return p.estado === "angariado";
        if (estado === "perdido") return p.estado === "perdido";
        return p.estado !== "angariado" && p.estado !== "perdido";
      }),
    [base, estado, fase]
  );

  // Só se desenham 60 de cada vez, por causa do telemóvel
  const [limite, setLimite] = useState(60);
  useEffect(() => {
    setLimite(60);
  }, [base]);

  // "recentes" = pela ordem em que chegaram. "Sem contacto há mais tempo" põe primeiro quem nunca foi contactado.
  const ordenada = useMemo(() => {
    const l = [...lista];
    if (ordem === "valor") l.sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    else if (ordem === "nome") l.sort((a, b) => a.contactos.nome.localeCompare(b.contactos.nome, "pt"));
    else if (ordem === "parados") l.sort((a, b) => (ultimos[a.contacto_id] ?? "").localeCompare(ultimos[b.contacto_id] ?? ""));
    return l;
  }, [lista, ordem, ultimos]);

  const nVisiveis = vista === "lista" ? lista.length : base.filter((p) => p.estado !== "perdido").length;
  const temFiltros = Boolean(pesquisa || tipo || tipologia || local.distrito || valorMin || valorMax || soAtrasados);
  function limpar() {
    setTipo("");
    setTipologia("");
    setLocal(SEM_LOCAL);
    setValorMin("");
    setValorMax("");
    setSoAtrasados(false);
    setPesquisa("");
  }
  const sel = "rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex flex-1 rounded-xl bg-black/5 p-1 text-sm font-medium">
          {(["lista", "funil"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`flex-1 rounded-lg py-2 ${vista === v ? "bg-white text-tinta shadow-sm" : "text-tinta/70"}`}
            >
              {v === "lista" ? "Lista" : "Funil"}
            </button>
          ))}
        </div>
        <Link href="/crm/proprietarios/novo" className="flex flex-1 items-center justify-center rounded-xl bg-azul px-4 text-sm font-semibold text-white">
          Novo proprietário
        </Link>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
        <BarraPesquisaFiltros
          pesquisa={pesquisa}
          onPesquisa={setPesquisa}
          aberto={painel}
          onAlternar={() => setPainel((x) => !x)}
          nAtivos={[tipo, tipologia, local.distrito, valorMin, valorMax].filter(Boolean).length + (soAtrasados ? 1 : 0) + (estado !== "seguimento" ? 1 : 0)}
        />
        {painel && (
        <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {vista === "lista" ? (
            <select value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)} className={sel}>
              <option value="seguimento">Em seguimento</option>
              <option value="angariado">Angariados</option>
              <option value="perdido">Perdidos</option>
              <option value="todos">Todos</option>
            </select>
          ) : (
            <div className={`${sel} text-secundario`}>Todas as fases</div>
          )}
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={sel}>
            <option value="">Tipo de imóvel</option>
            {TIPOS_IMOVEL.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={tipologia} onChange={(e) => setTipologia(e.target.value)} className={sel}>
            <option value="">Tipologia</option>
            {TIPOLOGIAS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="flex gap-1">
            <input value={valorMin} onChange={(e) => setValorMin(e.target.value)} type="number" inputMode="numeric" placeholder="Valor de" className={`${sel} w-1/2 min-w-0`} />
            <input value={valorMax} onChange={(e) => setValorMax(e.target.value)} type="number" inputMode="numeric" placeholder="até" className={`${sel} w-1/2 min-w-0`} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SeletorLocalizacao valor={local} onChange={setLocal} className={`${sel} w-full`} />
        </div>
        <label className="flex items-center gap-2 px-1 text-sm">
          <input type="checkbox" checked={soAtrasados} onChange={(e) => setSoAtrasados(e.target.checked)} />
          Só com follow up em atraso
        </label>
        </div>
        )}

        <div className="flex items-center justify-between text-xs text-secundario">
          <span className="shrink-0 whitespace-nowrap">{nVisiveis} {nVisiveis === 1 ? "proprietário" : "proprietários"}</span>
          {vista === "lista" && (
            <SeletorOrdem
              valor={ordem}
              onChange={setOrdem}
              opcoes={[
                ["recentes", "Mais recentes"],
                ["parados", "Sem contacto há mais tempo"],
                ["valor", "Maior valor"],
                ["nome", "Nome"],
              ]}
            />
          )}
          {temFiltros && <button onClick={limpar} className="font-medium text-azul">Limpar</button>}
        </div>
      </div>

      {fase && (fase === "perdido" || FUNIL_PROP.some((f) => f.id === fase)) && (
        <p className="flex w-fit items-center gap-1 rounded-full bg-azul-suave py-1 pl-3 pr-1 text-sm text-azul-escuro">
          Fase: {labelEstadoProp(fase as EstadoProprietario)}
          <button onClick={() => setFase("")} aria-label="Tirar o filtro de fase" className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none hover:bg-white/60">
            &times;
          </button>
        </p>
      )}
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {aCarregar ? (
        <EsqueletoLista />
      ) : vista === "funil" ? (
        <Funil props={base} proximas={proximas} atrasado={atrasado} />
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-secundario">
          {props.length === 0 ? "Ainda não há proprietários. Cria o primeiro." : pesquisa.trim() ? `Nenhum resultado para "${pesquisa.trim()}".` : "Nenhum proprietário com estes filtros."}
        </p>
      ) : (
        <>
        <ul className="space-y-2">
          {ordenada.slice(0, limite).map((p) => (
            <li key={p.id}>
              <SwipeLinha
                {...swipeContacto(p.contactos.telemovel, async () => {
                  const id = await registarChamadaAgora(p.contacto_id);
                  if (!id) return;
                  setUltimos((u) => ({ ...u, [p.contacto_id]: new Date().toISOString() }));
                  avisar("Chamada registada.", { rotulo: "Desfazer", onAcao: () => apagarChamada(id).then(() => ultimosContactos().then(setUltimos)) });
                })}
              >
                <Cartao p={p} proxima={proximas[p.id]} atrasado={atrasado(p.id)} ultimo={ultimos[p.contacto_id]} />
              </SwipeLinha>
            </li>
          ))}
        </ul>
        {lista.length > limite && (
          <button
            onClick={() => setLimite((l) => l + 60)}
            className="mt-3 w-full rounded-full bg-black/5 py-3 text-sm font-medium text-tinta"
          >
            Mostrar mais ({lista.length - limite} por mostrar)
          </button>
        )}
        </>
      )}
    </div>
  );
}

function Cartao({ p, proxima, atrasado, compacto, ultimo }: { p: Proprietario; proxima?: ProximaAcao; atrasado: boolean; compacto?: boolean; ultimo?: string }) {
  return (
    <Link href={`/crm/proprietarios/${p.id}`} className={`block rounded-2xl border border-linha bg-white ${compacto ? "rounded-xl p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-semibold text-tinta ${compacto ? "text-sm" : "text-base"}`}>{p.contactos.nome}</p>
          <p className="truncate text-xs text-secundario">
            {[p.tipo_imovel, p.tipologia, p.concelho || p.distrito].filter(Boolean).join(" · ") || "Sem qualificação"}
          </p>
        </div>
        {!compacto && (
          <span className="shrink-0 rounded-full bg-azul/10 px-2.5 py-1 text-xs font-medium text-azul-escuro">
            {labelEstadoProp(p.estado)}
          </span>
        )}
      </div>
      {p.valor != null && (
        <p className="mt-1 text-xs text-secundario">{p.valor.toLocaleString("pt-PT")} EUR</p>
      )}
      {!compacto && (
        <p className={`mt-1 text-xs ${ultimo && Date.now() - new Date(ultimo).getTime() < 14 * 86400000 ? "text-secundario" : "font-medium text-ambar-texto"}`}>
          {ultimo ? `Último contacto ${haQuanto(ultimo)}` : "Ainda sem chamadas registadas"}
        </p>
      )}
      {proxima && (
        <p className={`mt-2 truncate rounded-lg px-2.5 py-1.5 text-xs font-medium ${atrasado ? "bg-ambar-fundo text-ambar-texto" : "bg-black/5 text-secundario"}`}>
          {atrasado ? "Em atraso: " : ""}
          {proxima.titulo} · {formatarDia(new Date(proxima.inicio))} {formatarHora(proxima.inicio)}
        </p>
      )}
    </Link>
  );
}

function Funil({
  props,
  proximas,
  atrasado,
}: {
  props: Proprietario[];
  proximas: Record<string, ProximaAcao>;
  atrasado: (id: string) => boolean;
}) {
  return (
    <div data-no-swipe className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
      <div className="flex gap-3">
        {FUNIL_PROP.map((fase) => {
          const daFase = props.filter((p) => p.estado === fase.id);
          return (
            <section key={fase.id} className="w-64 shrink-0 rounded-2xl bg-black/[0.04] p-2">
              <h3 className="flex items-center justify-between px-2 py-2 text-xs font-semibold text-tinta">
                <span>{fase.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-secundario shadow-sm">{daFase.length}</span>
              </h3>
              <ul className="space-y-2">
                {daFase.length === 0 && <li className="px-2 py-3 text-xs text-secundario/60">Vazio</li>}
                {daFase.map((p) => (
                  <li key={p.id}>
                    <Cartao p={p} proxima={proximas[p.id]} atrasado={atrasado(p.id)} compacto />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
