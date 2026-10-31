"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import FormComprador, { guardarZonas, nomeZona, paraComprador, paraContacto, valoresIniciais } from "@/components/crm/FormComprador";
import type { Localizacao } from "@/components/crm/SeletorLocalizacao";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import ListaCorrespondencias from "@/components/oportunidades/ListaCorrespondencias";
import ContactosRegistados from "@/components/crm/ContactosRegistados";
import AgendaDoComprador from "@/components/crm/AgendaDoComprador";
import BotaoExportar from "@/components/crm/BotaoExportar";
import { atualizarPorComprador, carregarDoComprador, responder, type Correspondencia } from "@/lib/oportunidades";
import {
  DOCUMENTOS_ESCRITURA,
  FUNIL,
  OBJETIVOS,
  alertaLaranja,
  concluirTarefasSemanais,
  contar,
  indiceFunil,
  labelEstado,
  type Comprador,
  type EstadoComprador,
  type ImovelComprador,
} from "@/lib/comprador";
import BarraProgresso from "@/components/BarraProgresso";
import EditorVisita from "@/components/crm/EditorVisita";
import CampoData from "@/components/crm/CampoData";
import Comissao from "@/components/crm/Comissao";
import { diasAte, hojeISO } from "@/lib/datas";
import { eur } from "@/lib/graficos";
import { linkWhatsapp } from "@/lib/whatsapp";

type Documento = { id: string; nome: string; entregue: boolean };
type AngMinha = { id: string; titulo: string; vendido_em: string | null };

export default function FichaComprador() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Comprador | null>(null);
  const [imoveis, setImoveis] = useState<ImovelComprador[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [zonas, setZonas] = useState<Localizacao[]>([]);
  const [corresp, setCorresp] = useState<Correspondencia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [novoImovel, setNovoImovel] = useState("");
  const [angs, setAngs] = useState<AngMinha[]>([]);
  const [angSel, setAngSel] = useState("");
  const [novoDoc, setNovoDoc] = useState("");
  const [verTodosImoveis, setVerTodosImoveis] = useState(false);

  const carregar = useCallback(async () => {
    const sb = sbBrowser();
    const [r1, r2, r3, r4, r5, cs] = await Promise.all([
      sb.from("compradores").select("*, contactos(*)").eq("id", id).single(),
      sb.from("comprador_imoveis").select("*").eq("comprador_id", id).order("created_at"),
      sb.from("comprador_documentos").select("*").eq("comprador_id", id).order("created_at"),
      sb.from("angariacoes").select("id, titulo, vendido_em").order("created_at", { ascending: false }),
      sb.from("comprador_zonas").select("distrito, concelho, freguesia").eq("comprador_id", id).order("created_at"),
      carregarDoComprador(id),
    ]);
    if (r1.error || !r1.data) {
      setErro("Comprador não encontrado.");
      return;
    }
    setC(r1.data as unknown as Comprador);
    setImoveis((r2.data ?? []) as ImovelComprador[]);
    setDocs((r3.data ?? []) as Documento[]);
    setAngs((r4.data ?? []) as AngMinha[]);
    setZonas(((r5.data ?? []) as { distrito: string; concelho: string | null; freguesia: string | null }[]).map((z) => ({ distrito: z.distrito, concelho: z.concelho ?? "", freguesia: z.freguesia ?? "" })));
    setCorresp(cs);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(campos: Record<string, unknown>) {
    setErro(null);
    const { error } = await sbBrowser().from("compradores").update(campos).eq("id", id);
    if (error) setErro("Não foi possível guardar. Tenta outra vez.");
    await carregar();
  }

  // O funil só avança sozinho (nunca recua). Recuar é feito à mão no seletor de estado.
  async function avancarPara(estado: EstadoComprador, atual: EstadoComprador) {
    if (indiceFunil(estado) > indiceFunil(atual) && atual !== "perdido") {
      await atualizar({ estado, estado_desde: new Date().toISOString() });
    }
  }

  async function mudarEstado(estado: EstadoComprador) {
    if (!c || estado === c.estado) return;
    if (estado === "negocio_concluido") return concluir();
    await atualizar({ estado, estado_desde: new Date().toISOString() });
  }

  // Escritura efetuada: aviso para ligar ao cliente 6 meses depois (desenho do funil).
  async function concluir() {
    if (!c) return;
    const sb = sbBrowser();
    await atualizar({ estado: "negocio_concluido", estado_desde: new Date().toISOString() });
    const em6meses = new Date();
    em6meses.setMonth(em6meses.getMonth() + 6);
    em6meses.setHours(9, 0, 0, 0);
    const chave = `comprador:${c.id}:pos-escritura`;
    const { data } = await sb.from("tarefas").select("id").eq("chave_automacao", chave);
    if (!data || data.length === 0) {
      await sb.from("tarefas").insert({
        titulo: `Ligar a ${c.contactos.nome} (6 meses após a escritura)`,
        inicio: em6meses.toISOString(),
        origem: "comprador",
        comprador_id: c.id,
        contacto_id: c.contacto_id,
        chave_automacao: chave,
      });
    }
  }

  async function adicionarImovel(e: React.FormEvent) {
    e.preventDefault();
    const texto = novoImovel.trim();
    if ((!texto && !angSel) || !c) return;
    const eLink = /^https?:\/\//i.test(texto);
    const minha = angs.find((a) => a.id === angSel);
    const { error } = await sbBrowser()
      .from("comprador_imoveis")
      .insert({
        comprador_id: id,
        link: eLink ? texto : null,
        descricao: eLink ? null : texto || minha?.titulo || null,
        angariacao_id: angSel || null,
        enviado_em: hojeISO(),
      });
    if (error) return setErro("Não foi possível adicionar o imóvel.");
    setNovoImovel("");
    setAngSel("");
    await concluirTarefasSemanais(c.id, "enviar");
    await avancarPara("imoveis_enviados", c.estado);
    await carregar();
  }

  async function alternarMarco(i: ImovelComprador, campo: "enviado_em" | "visitado_em" | "proposta_em" | "sem_interesse_em") {
    if (!c) return;
    const novo = i[campo] ? null : hojeISO();
    const { error } = await sbBrowser().from("comprador_imoveis").update({ [campo]: novo }).eq("id", i.id);
    if (error) return setErro("Não foi possível guardar.");
    if (novo) {
      if (campo === "enviado_em") await concluirTarefasSemanais(c.id, "enviar");
      if (campo === "visitado_em") await concluirTarefasSemanais(c.id, "visita");
      if (campo === "visitado_em") await avancarPara("visitas_realizadas", c.estado);
      if (campo === "proposta_em") await avancarPara("propostas_efetuadas", c.estado);
    }
    await carregar();
  }

  async function atualizarImovel(i: ImovelComprador, campos: { visitado_em?: string; visita_obs?: string | null; proposta_em?: string; proposta_obs?: string | null }) {
    const { error } = await sbBrowser().from("comprador_imoveis").update(campos).eq("id", i.id);
    if (error) setErro("Não foi possível guardar.");
    await carregar();
  }

  async function apagarImovel(i: ImovelComprador) {
    if (!window.confirm("Remover este imóvel do comprador?")) return;
    await sbBrowser().from("comprador_imoveis").delete().eq("id", i.id);
    await carregar();
  }

  async function adicionarDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!novoDoc.trim()) return;
    await sbBrowser().from("comprador_documentos").insert({ comprador_id: id, nome: novoDoc.trim() });
    setNovoDoc("");
    await carregar();
  }

  // Junta a lista habitual, sem repetir os que já existem (ignora maiúsculas)
  async function usarListaPadrao() {
    const existentes = new Set(docs.map((d) => d.nome.trim().toLowerCase()));
    const novos = DOCUMENTOS_ESCRITURA.filter((n) => !existentes.has(n.toLowerCase()));
    if (novos.length === 0) return;
    const { error } = await sbBrowser().from("comprador_documentos").insert(novos.map((nome) => ({ comprador_id: id, nome })));
    if (error) return setErro("Não foi possível juntar a lista de documentos.");
    await carregar();
  }

  async function alternarDoc(d: Documento) {
    setDocs((ds) => ds.map((x) => (x.id === d.id ? { ...x, entregue: !x.entregue } : x)));
    await sbBrowser().from("comprador_documentos").update({ entregue: !d.entregue }).eq("id", d.id);
  }

  async function apagarComprador() {
    if (!c) return;
    if (!window.confirm(`Apagar ${c.contactos.nome} e todo o histórico? Não dá para desfazer.`)) return;
    await sbBrowser().from("contactos").delete().eq("id", c.contacto_id);
    router.push("/crm/compradores");
  }

  if (erro && !c) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  if (!c) return <EsqueletoLista n={3} />;

  const n = contar(imoveis);
  const alerta = alertaLaranja(c);
  const tel = c.contactos.telemovel;
  const diasEscritura = c.escritura_prazo ? diasAte(c.escritura_prazo) : null;
  const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";

  if (editar) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditar(false)} className="text-sm font-medium text-azul-escuro">&larr; Cancelar</button>
        <FormComprador
          inicial={valoresIniciais(c, zonas)}
          textoBotao="Guardar alterações"
          aGuardar={aGuardar}
          onSubmit={async (v) => {
            setAGuardar(true);
            const sb = sbBrowser();
            const r1 = await sb.from("contactos").update(paraContacto(v)).eq("id", c.contacto_id);
            const r2 = await sb.from("compradores").update(paraComprador(v)).eq("id", c.id);
            const eZonas = await guardarZonas(c.id, v);
            if (!r1.error && !r2.error && !eZonas) await atualizarPorComprador(c.id);
            setAGuardar(false);
            if (r1.error || r2.error || eZonas) return setErro(eZonas ?? "Não foi possível guardar.");
            setEditar(false);
            await carregar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/crm/compradores" className="text-sm font-medium text-azul-escuro">&larr; Compradores</Link>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className="space-y-4 rounded-3xl border border-linha bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-tinta">{c.contactos.nome}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.estado === "perdido" ? "bg-black/5 text-secundario" : "bg-azul-suave text-azul-escuro"}`}>
                {labelEstado(c.estado)}
              </span>
              {c.motivacao != null && (
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `hsl(${(c.motivacao / 10) * 120} 70% 42% / 0.12)`, color: `hsl(${(c.motivacao / 10) * 120} 70% 22%)` }}>
                  Motivação {c.motivacao}/10
                </span>
              )}
              {alerta && <span className="rounded-full bg-ambar-fundo px-2.5 py-1 text-xs font-semibold text-ambar-texto">{alerta}</span>}
            </div>
          </div>
          <button onClick={() => setEditar(true)} className="shrink-0 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
            Editar
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {(
            [
              ["Procura", [c.tipo_imovel, c.tipologia_minima && `${c.tipologia_minima} ou mais`].filter(Boolean).join(", ")],
              ["Orçamento", c.expectativa_valor != null ? eur(Number(c.expectativa_valor)) : ""],
              ["Zonas", zonas.length > 0 ? zonas.map(nomeZona).join(" / ") : [c.freguesia, c.concelho, c.distrito].filter(Boolean).join(", ")],
              ["Financiamento", [c.financiamento, c.simulacao_credito && `simulação ${c.simulacao_credito.toLowerCase()}`].filter(Boolean).join(", ")],
              ["Precisa de vender", c.precisa_vender == null ? "" : c.precisa_vender ? "Sim" : "Não"],
              ["Origem", c.contactos.canal_origem ?? ""],
              ["Telemóvel", c.contactos.telemovel ?? ""],
              ["Email", c.contactos.email ?? ""],
              ["Notas", c.contactos.observacoes ?? ""],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className={k === "Zonas" || k === "Email" || k === "Notas" ? "col-span-2" : ""}>
                <dt className="text-xs text-secundario">{k}</dt>
                <dd className="break-words font-medium text-tinta">{v}</dd>
              </div>
            ))}
        </dl>

        {tel && (
          <div className="flex gap-2">
            <a href={`tel:${tel}`} className="flex-1 rounded-full bg-azul py-3 text-center text-base font-semibold text-white">
              Ligar
            </a>
            <a
              href={linkWhatsapp(tel)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full bg-verde py-3 text-center text-base font-semibold text-tinta"
            >
              WhatsApp
            </a>
          </div>
        )}
      </section>

      <AgendaDoComprador compradorId={c.id} contactoId={c.contacto_id} nome={c.contactos.nome} imoveis={imoveis} />

      <ContactosRegistados contactoId={c.contacto_id} />

      {corresp.length > 0 && (
        <section className={cartao}>
          <h3 className="text-sm font-semibold text-tinta">Imóveis que podem servir ({corresp.filter((x) => x.estado === "nova").length} por rever)</h3>
          <ListaCorrespondencias
            itens={corresp}
            mostrar="imovel"
            onResponder={async (x, estado) => {
              await responder(x.id, estado);
              await carregar();
            }}
          />
        </section>
      )}

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Funil</h3>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FUNIL.map((f, i) => {
            const ativo = c.estado === f.id;
            const passado = c.estado !== "perdido" && i < indiceFunil(c.estado);
            return (
              <button
                key={f.id}
                onClick={() => mudarEstado(f.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  ativo ? "bg-azul text-white" : passado ? "bg-azul/15 text-azul-escuro" : "bg-black/5 text-secundario"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-secundario">
          Estado atual: {labelEstado(c.estado)}.{" "}
          {c.estado !== "perdido" ? (
            <button onClick={() => mudarEstado("perdido")} className="underline">Marcar como perdido</button>
          ) : (
            <button onClick={() => mudarEstado("lead_qualificada")} className="underline">Reativar</button>
          )}
        </p>
      </section>

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Imóveis</h3>
        {([
          ["Enviados", n.enviados, OBJETIVOS.enviados],
          ["Visitas", n.visitas, OBJETIVOS.visitas],
          ["Propostas", n.propostas, OBJETIVOS.propostas],
        ] as const).map(([rotulo, valor, objetivo]) => (
          <div key={rotulo}>
            <div className="flex justify-between text-xs text-secundario">
              <span>{rotulo}</span>
              <span>{valor}/{objetivo}</span>
            </div>
            <BarraProgresso valor={valor} objetivo={objetivo} />
          </div>
        ))}

        <ul className="space-y-2 pt-1">
          {(verTodosImoveis ? imoveis : imoveis.slice(-3)).map((i) => (
            <li key={i.id}>
              <SwipeLinha
                className="rounded-xl"
                direita={
                  !i.visitado_em
                    ? { rotulo: "Visitado", classe: "bg-verde text-tinta", onAcao: () => alternarMarco(i, "visitado_em") }
                    : !i.proposta_em
                    ? { rotulo: "Proposta", classe: "bg-verde text-tinta", onAcao: () => alternarMarco(i, "proposta_em") }
                    : undefined
                }
                esquerda={{ rotulo: "Remover", classe: "bg-red-600 text-white", onAcao: () => apagarImovel(i) }}
              >
              <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                {i.link ? (
                  <a href={i.link} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm text-azul">{i.link}</a>
                ) : (
                  <p className="min-w-0 truncate text-sm text-tinta">{i.descricao}</p>
                )}
                <button onClick={() => apagarImovel(i)} aria-label="Remover" className="text-secundario">&times;</button>
              </div>
              {i.angariacao_id && (
                <Link href={`/angariacoes/${i.angariacao_id}`} className="mt-0.5 block truncate text-xs text-azul">
                  Angariação: {angs.find((a) => a.id === i.angariacao_id)?.titulo ?? "ver angariação"}
                </Link>
              )}
              <div className="mt-2 flex gap-1.5">
                {([
                  ["enviado_em", "Enviado"],
                  ["visitado_em", "Visitado"],
                  ["proposta_em", "Proposta"],
                  ["sem_interesse_em", "Sem interesse"],
                ] as const).map(([campo, rotulo]) => (
                  <button
                    key={campo}
                    onClick={() => alternarMarco(i, campo)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
                      i[campo] ? (campo === "sem_interesse_em" ? "bg-red-600 text-white" : "bg-verde text-white") : "bg-black/5 text-secundario"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {i.visitado_em && (
                <div className="mt-2">
                  <EditorVisita
                    data={i.visitado_em}
                    obs={i.visita_obs}
                    onData={(d) => atualizarImovel(i, { visitado_em: d })}
                    onObs={(t) => atualizarImovel(i, { visita_obs: t.trim() || null })}
                  />
                </div>
              )}
              {i.proposta_em && (
                <div className="mt-2">
                  <EditorVisita
                    tipo="proposta"
                    data={i.proposta_em}
                    obs={i.proposta_obs}
                    onData={(d) => atualizarImovel(i, { proposta_em: d })}
                    onObs={(t) => atualizarImovel(i, { proposta_obs: t.trim() || null })}
                  />
                </div>
              )}
              </div>
              </SwipeLinha>
            </li>
          ))}
        </ul>
        {imoveis.length > 3 && (
          <button onClick={() => setVerTodosImoveis((v) => !v)} className="text-sm font-medium text-azul">
            {verTodosImoveis ? "Mostrar só os 3 mais recentes" : `Ver os ${imoveis.length} imóveis`}
          </button>
        )}
        <form onSubmit={adicionarImovel} className="space-y-2">
          <select
            value={angSel}
            onChange={(e) => setAngSel(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Uma angariação minha (opcional)</option>
            {angs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
                {a.vendido_em ? " (vendido)" : ""}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={novoImovel}
              onChange={(e) => setNovoImovel(e.target.value)}
              placeholder={angSel ? "Link (opcional)" : "Link ou descrição do imóvel enviado"}
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={!novoImovel.trim() && !angSel}
              className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Juntar
            </button>
          </div>
        </form>
      </section>

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">CPCV</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.cpcv_fechado}
            onChange={async (e) => {
              await atualizar({ cpcv_fechado: e.target.checked, cpcv_data: e.target.checked ? c.cpcv_data ?? hojeISO() : null });
              if (e.target.checked) await avancarPara("cpcv", c.estado);
            }}
          />
          CPCV fechado
        </label>
        {c.cpcv_fechado && (
          <CampoData label="Data do CPCV" value={c.cpcv_data} onCommit={(v) => atualizar({ cpcv_data: v })} />
        )}
        {c.cpcv_fechado && <Comissao dados={c} onChange={atualizar} />}
      </section>

      {c.cpcv_fechado && (
        <section className={cartao}>
          <h3 className="text-sm font-semibold text-tinta">Escritura</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.escritura_agendada}
              onChange={async (e) => {
                await atualizar({ escritura_agendada: e.target.checked });
                if (e.target.checked) await avancarPara("escritura", c.estado);
              }}
            />
            Escritura agendada
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.escritura_agendada && (
              <CampoData label="Data da escritura" value={c.escritura_data} onCommit={(v) => atualizar({ escritura_data: v })} />
            )}
            <CampoData label="Prazo da escritura" value={c.escritura_prazo} onCommit={(v) => atualizar({ escritura_prazo: v })} />
          </div>
          {diasEscritura !== null && (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                diasEscritura < 0 ? "bg-red-50 text-red-700" : diasEscritura <= 15 ? "bg-ambar-fundo text-ambar-texto" : "bg-black/5 text-tinta"
              }`}
            >
              {diasEscritura < 0
                ? `Prazo ultrapassado há ${-diasEscritura} dias`
                : diasEscritura === 0
                ? "O prazo termina hoje"
                : `Faltam ${diasEscritura} dias para terminar o prazo`}
            </p>
          )}

          <Comissao dados={c} onChange={atualizar} soRecebida />

          <h4 className="pt-1 text-xs font-semibold text-secundario">
            Documentos em falta ({docs.filter((d) => !d.entregue).length})
          </h4>
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.id}>
                <SwipeLinha
                  className="rounded-lg"
                  direita={{ rotulo: d.entregue ? "Por entregar" : "Entregue", classe: d.entregue ? "bg-secundario text-tinta" : "bg-verde text-tinta", onAcao: () => alternarDoc(d) }}
                >
                  <label className="flex items-center gap-2 bg-white py-1 text-sm">
                    <input type="checkbox" checked={d.entregue} onChange={() => alternarDoc(d)} />
                    <span className={d.entregue ? "text-secundario line-through" : "text-tinta"}>{d.nome}</span>
                  </label>
                </SwipeLinha>
              </li>
            ))}
          </ul>
          {DOCUMENTOS_ESCRITURA.some((n) => !docs.some((d) => d.nome.trim().toLowerCase() === n.toLowerCase())) && (
            <button type="button" onClick={usarListaPadrao} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
              {docs.length === 0 ? "Usar a lista habitual" : "Juntar os que faltam da lista habitual"}
            </button>
          )}
          <form onSubmit={adicionarDoc} className="flex gap-2">
            <input
              value={novoDoc}
              onChange={(e) => setNovoDoc(e.target.value)}
              placeholder="Adicionar documento"
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
            />
            <button type="submit" disabled={!novoDoc.trim()} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
              Juntar
            </button>
          </form>

          {c.estado === "escritura" && (
            <button onClick={concluir} className="w-full rounded-xl bg-verde py-3 text-sm font-semibold text-tinta">
              Escritura feita: concluir negócio
            </button>
          )}
        </section>
      )}

      <BotaoExportar contactoId={c.contacto_id} nome={c.contactos.nome} />

      <button onClick={apagarComprador} className="w-full py-2 text-sm font-medium text-red-700">
        Apagar comprador
      </button>
    </div>
  );
}
